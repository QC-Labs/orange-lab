import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Storage } from './storage';
import { ContainerSpec, VolumeMount, InitContainerSpec } from './types';
import { Nodes } from './nodes';

export class Containers {
    metadata: kubernetes.types.input.meta.v1.ObjectMeta;
    serviceAccount: kubernetes.core.v1.ServiceAccount;
    spec: ContainerSpec;
    storage?: Storage;
    nodes: Nodes;
    config: pulumi.Config;

    constructor(
        private appName: string,
        args: {
            spec: ContainerSpec;
            metadata: kubernetes.types.input.meta.v1.ObjectMeta;
            serviceAccount: kubernetes.core.v1.ServiceAccount;
            storage?: Storage;
            nodes: Nodes;
            config: pulumi.Config;
        },
    ) {
        this.spec = args.spec;
        this.metadata = args.metadata;
        this.serviceAccount = args.serviceAccount;
        this.storage = args.storage;
        this.nodes = args.nodes;
        this.config = args.config;
    }

    public createPodTemplateSpec(): kubernetes.types.input.core.v1.PodTemplateSpec {
        return {
            metadata: this.metadata,
            spec: {
                affinity: this.nodes.getAffinity(),
                securityContext: this.createPodSecurityContext(),
                hostNetwork: this.spec.hostNetwork,
                containers: [
                    {
                        args: Array.isArray(this.spec.commandArgs)
                            ? this.spec.commandArgs.filter(Boolean)
                            : this.spec.commandArgs,
                        command: this.spec.command,
                        env: this.createEnv(),
                        envFrom: this.createEnvSecret(),
                        image: this.spec.image,
                        livenessProbe: this.createProbe(),
                        name: this.metadata.name ?? this.appName,
                        ports: this.createPorts(),
                        readinessProbe: this.createProbe(),
                        resources: this.createResourceLimits(),
                        securityContext: this.createSecurityContext(),
                        startupProbe: this.createProbe({ failureThreshold: 10 }),
                        volumeMounts: this.createVolumeMounts(this.spec.volumeMounts),
                    },
                ],
                initContainers: this.createInitContainers(this.spec.initContainers),
                restartPolicy: this.spec.restartPolicy,
                serviceAccountName: this.serviceAccount.metadata.name,
                runtimeClassName: this.nodes.gpu === 'nvidia' ? 'nvidia' : undefined,
                volumes: this.createVolumes(),
            },
        };
    }

    createInitContainers(
        initContainers?: InitContainerSpec[],
    ):
        | pulumi.Input<pulumi.Input<kubernetes.types.input.core.v1.Container>[]>
        | undefined {
        return initContainers?.map(initContainer => ({
            name: initContainer.name,
            image: initContainer.image ?? 'alpine:latest',
            command: initContainer.command,
            volumeMounts: this.createVolumeMounts(
                initContainer.volumeMounts ?? this.spec.volumeMounts,
            ),
        }));
    }

    private createSecurityContext():
        | kubernetes.types.input.core.v1.SecurityContext
        | undefined {
        if (this.nodes.gpu === 'amd') {
            return { seccompProfile: { type: 'Unconfined' } };
        }
        return this.nodes.gpu || this.storage?.hasLocal()
            ? { privileged: true }
            : undefined;
    }

    private createPorts() {
        const ports = [
            ...(this.spec.port ? [{ name: 'http', port: this.spec.port }] : []),
            ...(this.spec.ports ?? []),
        ];
        return ports.map(port => ({
            name: port.name,
            containerPort: port.port,
            protocol: 'TCP',
        }));
    }

    private createVolumes() {
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
        return this.storage?.createVolumes();
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

    private createPodSecurityContext() {
        return this.spec.runAsUser
            ? {
                  runAsUser: this.spec.runAsUser,
                  runAsGroup: this.spec.runAsUser,
                  fsGroup: this.spec.runAsUser,
              }
            : undefined;
    }

    private createResourceLimits() {
        switch (this.nodes.gpu) {
            case 'nvidia':
                return {
                    ...this.spec.resources,
                    limits: {
                        ...this.spec.resources?.limits,
                        'nvidia.com/gpu': '1',
                    },
                };
            case 'amd':
                return {
                    ...this.spec.resources,
                    limits: {
                        ...this.spec.resources?.limits,
                        'amd.com/gpu': '1',
                    },
                };
            default:
                return this.spec.resources;
        }
    }

    private createProbe(opts?: { failureThreshold?: number }) {
        return this.spec.healthChecks
            ? {
                  httpGet: { path: '/', port: 'http' },
                  failureThreshold: opts?.failureThreshold,
              }
            : undefined;
    }

    private createEnv() {
        const gfxVersion = this.config.get('HSA_OVERRIDE_GFX_VERSION');
        const amdTargets = this.config.get('HCC_AMDGPU_TARGETS');
        const env = {
            ...this.spec.env,
            HSA_OVERRIDE_GFX_VERSION:
                this.nodes.gpu === 'amd' && gfxVersion ? gfxVersion : undefined,
            HCC_AMDGPU_TARGETS:
                this.nodes.gpu === 'amd' && amdTargets ? amdTargets : undefined,
        };
        return Object.entries(env)
            .filter(([_, value]) => value)
            .map(([key, value]) => ({ name: key, value }));
    }

    private createEnvSecret() {
        return this.spec.envSecret ? [{ secretRef: { name: this.appName } }] : undefined;
    }
}
