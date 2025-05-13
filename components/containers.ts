import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Storage } from './storage';

export interface ContainerSpec {
    name?: string;
    image: string;
    port?: number;
    ports?: { name: string; port: number; hostname?: string }[];
    commandArgs?: string[];
    env?: Record<string, string | pulumi.Output<string> | undefined>;
    hostNetwork?: boolean;
    volumeMounts?: { mountPath: string; name?: string; subPath?: string }[];
    healthChecks?: boolean;
    resources?: {
        limits?: { cpu?: string; memory?: string };
        requests?: { cpu?: string; memory?: string };
    };
    runAsUser?: number;
    restartPolicy?: string;
}

export class Containers {
    metadata: kubernetes.types.input.meta.v1.ObjectMeta;
    serviceAccount: kubernetes.core.v1.ServiceAccount;
    spec: ContainerSpec;
    affinity?: kubernetes.types.input.core.v1.Affinity;
    storage?: Storage;
    config: pulumi.Config;

    constructor(
        private appName: string,
        private args: {
            spec: ContainerSpec;
            metadata: kubernetes.types.input.meta.v1.ObjectMeta;
            serviceAccount: kubernetes.core.v1.ServiceAccount;
            storage?: Storage;
            affinity?: kubernetes.types.input.core.v1.Affinity;
            gpu?: 'nvidia' | 'amd';
            config: pulumi.Config;
        },
    ) {
        this.spec = args.spec;
        this.metadata = args.metadata;
        this.serviceAccount = args.serviceAccount;
        this.storage = args.storage;
        this.affinity = args.affinity;
        this.config = args.config;
    }

    public createPodTemplateSpec(): kubernetes.types.input.core.v1.PodTemplateSpec {
        return {
            metadata: this.metadata,
            spec: {
                affinity: this.affinity,
                securityContext: this.createPodSecurityContext(),
                hostNetwork: this.spec.hostNetwork,
                containers: [
                    {
                        args: this.spec.commandArgs,
                        env: this.createEnv(),
                        image: this.spec.image,
                        livenessProbe: this.createProbe(),
                        name: this.metadata.name ?? this.appName,
                        ports: this.createPorts(),
                        readinessProbe: this.createProbe(),
                        resources: this.createResourceLimits(),
                        securityContext: this.createSecurityContext(),
                        startupProbe: this.createProbe({ failureThreshold: 10 }),
                        volumeMounts: this.createVolumeMounts(),
                    },
                ],
                restartPolicy: this.spec.restartPolicy,
                serviceAccountName: this.serviceAccount.metadata.name,
                runtimeClassName: this.args.gpu === 'nvidia' ? 'nvidia' : undefined,
                volumes: this.createVolumes(),
            },
        };
    }

    private createSecurityContext():
        | kubernetes.types.input.core.v1.SecurityContext
        | undefined {
        if (this.args.gpu === 'amd') {
            return { seccompProfile: { type: 'Unconfined' } };
        }
        return this.args.gpu || this.storage?.hasLocal()
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
        if (this.args.gpu === 'amd') {
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

    private createVolumeMounts():
        | kubernetes.types.input.core.v1.VolumeMount[]
        | undefined {
        const mounts = (this.spec.volumeMounts ?? []).map(volumeMount => ({
            ...volumeMount,
            ...{ name: volumeMount.name ?? this.appName },
        }));
        if (this.args.gpu === 'amd') {
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
        switch (this.args.gpu) {
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
                this.args.gpu === 'amd' && gfxVersion ? gfxVersion : undefined,
            HCC_AMDGPU_TARGETS:
                this.args.gpu === 'amd' && amdTargets ? amdTargets : undefined,
        };
        return Object.entries(env)
            .filter(([_, value]) => value)
            .map(([key, value]) => ({ name: key, value }));
    }
}
