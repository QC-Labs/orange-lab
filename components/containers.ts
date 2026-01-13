import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import { Storage } from './storage';
import {
    ContainerResources,
    ContainerSpec,
    InitContainerSpec,
    ServicePort,
    VolumeMount,
} from './types';

export class Containers {
    metadata: Metadata;
    serviceAccount: kubernetes.core.v1.ServiceAccount;
    storage?: Storage;
    nodes: Nodes;
    config: pulumi.Config;

    constructor(
        private appName: string,
        args: {
            metadata: Metadata;
            serviceAccount: kubernetes.core.v1.ServiceAccount;
            storage?: Storage;
            nodes: Nodes;
            config: pulumi.Config;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {
        this.metadata = args.metadata;
        this.serviceAccount = args.serviceAccount;
        this.storage = args.storage;
        this.nodes = args.nodes;
        this.config = args.config;
    }

    public createPodTemplateSpec(
        spec: ContainerSpec,
    ): kubernetes.types.input.core.v1.PodTemplateSpec {
        const metadata = this.metadata.get({
            component: spec.name,
            annotations: this.storage?.configFilesHash
                ? { 'checksum/config': this.storage.configFilesHash }
                : undefined,
            includeVersionLabel: true,
        });
        return {
            metadata,
            spec: {
                affinity: this.nodes.getAffinity(),
                hostNetwork: spec.hostNetwork,
                containers: [
                    {
                        args: Array.isArray(spec.commandArgs)
                            ? spec.commandArgs.filter(Boolean)
                            : spec.commandArgs,
                        command: spec.command,
                        env: this.createEnv(spec.env),
                        envFrom: this.createEnvSecret({
                            containerName: spec.name,
                            secretData: spec.envSecret,
                        }),
                        image: spec.image,
                        livenessProbe: this.createProbe({
                            healthChecks: spec.healthChecks,
                        }),
                        name: metadata.name,
                        ports: this.createPorts({
                            port: spec.port,
                            ports: spec.ports,
                        }),
                        readinessProbe: this.createProbe({
                            healthChecks: spec.healthChecks,
                        }),
                        resources: this.createResourceLimits(spec.resources),
                        securityContext: this.createContainerSecurityContext(
                            spec.runAsUser,
                        ),
                        startupProbe: this.createProbe({
                            healthChecks: spec.healthChecks,
                            failureThreshold: 10,
                        }),
                        volumeMounts: this.createVolumeMounts(spec.volumeMounts),
                    },
                ],
                initContainers: this.createInitContainers({
                    initContainers: spec.initContainers,
                    volumeMounts: spec.volumeMounts,
                }),
                restartPolicy: spec.restartPolicy,
                serviceAccountName: this.serviceAccount.metadata.name,
                runtimeClassName: this.nodes.gpu === 'nvidia' ? 'nvidia' : undefined,
                volumes: this.createVolumes(spec.volumeMounts),
            },
        };
    }

    private createInitContainers(params: {
        initContainers?: InitContainerSpec[];
        volumeMounts?: VolumeMount[];
    }):
        | pulumi.Input<pulumi.Input<kubernetes.types.input.core.v1.Container>[]>
        | undefined {
        return params.initContainers?.map(initContainer => ({
            name: initContainer.name,
            image: initContainer.image ?? 'busybox:latest',
            command: initContainer.command,
            imagePullPolicy: 'IfNotPresent',
            securityContext: this.createInitContainerSecurityContext(),
            volumeMounts: this.createVolumeMounts(
                initContainer.volumeMounts ?? params.volumeMounts,
            ),
        }));
    }

    private createContainerSecurityContext(
        runAsUser?: number,
    ): kubernetes.types.input.core.v1.SecurityContext | undefined {
        const context: kubernetes.types.input.core.v1.SecurityContext = {};
        if (this.nodes.gpu === 'amd') {
            context.seccompProfile = { type: 'Unconfined' };
        } else if (this.nodes.gpu === 'nvidia' || this.storage?.hasLocal()) {
            context.privileged = true;
        }
        if (runAsUser) {
            context.runAsUser = runAsUser;
            context.runAsGroup = runAsUser;
        }
        return Object.keys(context).length ? context : undefined;
    }

    private createInitContainerSecurityContext():
        | kubernetes.types.input.core.v1.SecurityContext
        | undefined {
        return this.storage?.hasLocal() ? { privileged: true } : undefined;
    }

    private createPorts(args: { port?: number; ports?: ServicePort[] }) {
        const ports = [
            ...(args.port ? [{ name: 'http', port: args.port }] : []),
            ...(args.ports ?? []),
        ];
        return ports.map(port => ({
            name: port.name,
            containerPort: port.port,
            protocol: 'TCP',
        }));
    }

    private createVolumes(
        volumeMounts?: VolumeMount[],
    ): kubernetes.types.input.core.v1.Volume[] | undefined {
        if (this.nodes.gpu === 'amd') {
            this.storage?.addLocalVolume({
                name: 'dev-kfd',
                hostPath: '/dev/kfd',
                type: 'CharDevice',
            });
            this.storage?.addLocalVolume({
                name: 'dev-dri',
                hostPath: '/dev/dri',
                type: 'Directory',
            });
        }
        return volumeMounts?.length ? (this.storage?.createVolumes() ?? []) : undefined;
    }

    private createVolumeMounts(
        volumeMounts?: VolumeMount[],
    ): kubernetes.types.input.core.v1.VolumeMount[] | undefined {
        const mounts = (volumeMounts ?? []).map(volumeMount => ({
            ...volumeMount,
            ...{ name: volumeMount.name ?? this.appName },
        }));
        if (this.nodes.gpu === 'amd') {
            mounts.push({ name: 'dev-kfd', mountPath: '/dev/kfd' });
            mounts.push({ name: 'dev-dri', mountPath: '/dev/dri' });
        }
        return mounts;
    }

    private createResourceLimits(
        resources?: ContainerResources,
    ): kubernetes.types.input.core.v1.ResourceRequirements | undefined {
        switch (this.nodes.gpu) {
            case 'nvidia':
                return {
                    ...resources,
                    limits: { ...resources?.limits, 'nvidia.com/gpu': '1' },
                };
            // AMD does not support time slicing
            // Volumes used for direct device access instead of resource limits
            default:
                return resources;
        }
    }

    private createProbe(opts: { healthChecks?: boolean; failureThreshold?: number }) {
        return opts.healthChecks
            ? {
                  httpGet: { path: '/', port: 'http' },
                  failureThreshold: opts.failureThreshold,
              }
            : undefined;
    }

    private createEnv(
        specEnv?: Record<string, string | pulumi.Output<string> | undefined>,
    ) {
        const gfxVersion = this.config.get('HSA_OVERRIDE_GFX_VERSION');
        const amdTargets = this.config.get('HCC_AMDGPU_TARGETS');
        const env = {
            ...specEnv,
            HSA_OVERRIDE_GFX_VERSION:
                this.nodes.gpu === 'amd' && gfxVersion ? gfxVersion : undefined,
            HCC_AMDGPU_TARGETS:
                this.nodes.gpu === 'amd' && amdTargets ? amdTargets : undefined,
        };
        return Object.entries(env)
            .filter(([_, value]) => value)
            .map(([key, value]) => ({ name: key, value }));
    }

    private createEnvSecret(args: {
        containerName?: string;
        secretData?: Record<string, string | pulumi.Output<string> | undefined>;
    }) {
        if (!args.secretData) return;
        const metadata = this.metadata.get({ component: args.containerName });
        const secret = new kubernetes.core.v1.Secret(
            `${metadata.name}-env`,
            {
                metadata: {
                    ...metadata,
                    name: `${metadata.name}-env`,
                },
                immutable: true,
                // filter out undefined values
                stringData: Object.fromEntries(
                    Object.entries(args.secretData)
                        .filter(([_, v]) => v !== undefined)
                        .map(([k, v]) => [k, pulumi.output(v).apply(String)]),
                ),
            },
            this.opts,
        );
        return [{ secretRef: { name: secret.metadata.name } }];
    }
}
