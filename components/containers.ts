import * as kubernetes from '@pulumi/kubernetes';
import { Volumes } from './volumes';

export interface ContainerSpec {
    name?: string;
    image: string;
    port?: number;
    ports?: { name: string; port: number; hostname?: string }[];
    commandArgs?: string[];
    env?: Record<string, string | undefined>;
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
    volumes?: Volumes;

    constructor(
        private appName: string,
        private args: {
            spec: ContainerSpec;
            metadata: kubernetes.types.input.meta.v1.ObjectMeta;
            serviceAccount: kubernetes.core.v1.ServiceAccount;
            volumes?: Volumes;
            affinity?: kubernetes.types.input.core.v1.Affinity;
            gpu?: 'nvidia' | 'amd';
        },
    ) {
        this.spec = args.spec;
        this.metadata = args.metadata;
        this.serviceAccount = args.serviceAccount;
        this.volumes = args.volumes;
        this.affinity = args.affinity;
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
                        securityContext:
                            this.args.gpu || this.volumes?.hasLocal()
                                ? { privileged: true }
                                : undefined,
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
        return this.volumes?.create();
    }

    private createVolumeMounts() {
        return (this.spec.volumeMounts ?? []).map(volumeMount => ({
            ...volumeMount,
            ...{ name: volumeMount.name ?? this.appName },
        }));
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
        if (!this.spec.env) return undefined;
        return Object.entries(this.spec.env)
            .filter(([_, value]) => value)
            .map(([key, value]) => ({ name: key, value }));
    }
}
