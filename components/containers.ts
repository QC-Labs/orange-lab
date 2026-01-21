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
    constructor(
        private appName: string,
        private args: {
            metadata: Metadata;
            serviceAccount: kubernetes.core.v1.ServiceAccount;
            storage?: Storage;
            nodes: Nodes;
            config: pulumi.Config;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {}

    public createPodTemplateSpec(
        spec: ContainerSpec,
    ): kubernetes.types.input.core.v1.PodTemplateSpec {
        const metadata = this.args.metadata.get({
            component: spec.name,
            annotations: this.args.storage?.configFilesHash
                ? { 'checksum/config': this.args.storage.configFilesHash }
                : undefined,
            includeVersionLabel: true,
        });
        return {
            metadata,
            spec: {
                affinity: this.args.nodes.getAffinity(),
                hostNetwork: spec.hostNetwork,
                containers: [
                    {
                        args: spec.commandArgs
                            ? pulumi
                                  .output(spec.commandArgs)
                                  .apply(args => args.filter(Boolean))
                            : undefined,
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
                initContainers: this.createAllInitContainers(spec),
                restartPolicy: spec.restartPolicy,
                serviceAccountName: this.args.serviceAccount.metadata.name,
                runtimeClassName: this.args.nodes.gpu === 'nvidia' ? 'nvidia' : undefined,
                volumes: this.createVolumes(spec.volumeMounts),
            },
        };
    }

    private createAllInitContainers(
        spec: ContainerSpec,
    ): pulumi.Input<pulumi.Input<kubernetes.types.input.core.v1.Container>[]> {
        const initContainers = spec.initContainers ?? [];

        const mountPaths = this.getLocalVolumeMounts(spec.volumeMounts);
        if (spec.runAsUser && mountPaths.length > 0) {
            initContainers.push(
                this.createPermissionsInitContainer(spec.runAsUser, mountPaths),
            );
        }
        return this.createInitContainers(initContainers, spec.volumeMounts);
    }

    private createInitContainers(
        initContainerSpec: InitContainerSpec[],
        defaultVolumeMounts?: VolumeMount[],
    ): pulumi.Input<pulumi.Input<kubernetes.types.input.core.v1.Container>[]> {
        return initContainerSpec.map(initContainer => ({
            name: initContainer.name,
            image: initContainer.image ?? 'busybox:latest',
            command: initContainer.command,
            imagePullPolicy: 'IfNotPresent',
            securityContext: this.createInitContainerSecurityContext(),
            volumeMounts: this.createVolumeMounts(
                initContainer.volumeMounts ?? defaultVolumeMounts,
            ),
        }));
    }

    private createPermissionsInitContainer(
        runAsUser: number,
        mountPaths: string[],
    ): InitContainerSpec {
        const userId = String(runAsUser);
        const paths = mountPaths.join(' ');
        return {
            name: 'fix-volume-permissions',
            command: ['sh', '-c', `chown -R ${userId}:${userId} ${paths}`],
        };
    }

    private getLocalVolumeMounts(volumeMounts?: VolumeMount[]): string[] {
        const localVolumeNames =
            this.args.storage?.getLocalVolumes().map(v => v.name) ?? [];
        return (volumeMounts ?? [])
            .filter(mount => localVolumeNames.includes(mount.name ?? this.appName))
            .map(mount => mount.mountPath);
    }

    private createContainerSecurityContext(
        runAsUser?: number,
    ): kubernetes.types.input.core.v1.SecurityContext | undefined {
        const context: kubernetes.types.input.core.v1.SecurityContext = {};
        if (this.args.nodes.gpu === 'amd') {
            context.seccompProfile = { type: 'Unconfined' };
        } else if (this.args.nodes.gpu === 'nvidia' || this.args.storage?.hasLocal()) {
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
        return this.args.storage?.hasLocal() ? { privileged: true } : undefined;
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
        if (this.args.nodes.gpu === 'amd') {
            this.args.storage?.addLocalVolume({
                name: 'dev-kfd',
                hostPath: '/dev/kfd',
                type: 'CharDevice',
            });
            this.args.storage?.addLocalVolume({
                name: 'dev-dri',
                hostPath: '/dev/dri',
                type: 'Directory',
            });
        }
        return volumeMounts?.length ? (this.args.storage?.getVolumes() ?? []) : undefined;
    }

    private createVolumeMounts(
        volumeMounts?: VolumeMount[],
    ): kubernetes.types.input.core.v1.VolumeMount[] | undefined {
        const mounts = (volumeMounts ?? []).map(volumeMount => ({
            ...volumeMount,
            ...{ name: volumeMount.name ?? this.appName },
        }));
        if (this.args.nodes.gpu === 'amd') {
            mounts.push({ name: 'dev-kfd', mountPath: '/dev/kfd' });
            mounts.push({ name: 'dev-dri', mountPath: '/dev/dri' });
        }
        return mounts;
    }

    private createResourceLimits(
        resources?: ContainerResources,
    ): kubernetes.types.input.core.v1.ResourceRequirements | undefined {
        switch (this.args.nodes.gpu) {
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

    private createProbe(args: { healthChecks?: boolean; failureThreshold?: number }) {
        return args.healthChecks
            ? {
                  httpGet: { path: '/', port: 'http' },
                  failureThreshold: args.failureThreshold,
              }
            : undefined;
    }

    private createEnv(specEnv?: Record<string, pulumi.Input<string> | undefined>) {
        const gfxVersion = this.args.config.get('HSA_OVERRIDE_GFX_VERSION');
        const amdTargets = this.args.config.get('HCC_AMDGPU_TARGETS');
        const env = {
            ...specEnv,
            HSA_OVERRIDE_GFX_VERSION:
                this.args.nodes.gpu === 'amd' && gfxVersion ? gfxVersion : undefined,
            HCC_AMDGPU_TARGETS:
                this.args.nodes.gpu === 'amd' && amdTargets ? amdTargets : undefined,
        };
        return Object.entries(env)
            .filter(([_, value]) => value)
            .map(([key, value]) => ({ name: key, value }));
    }

    private createEnvSecret(args: {
        containerName?: string;
        secretData?: Record<string, pulumi.Input<string> | undefined>;
    }) {
        if (!args.secretData) return;
        const metadata = this.args.metadata.get({ component: args.containerName });
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
