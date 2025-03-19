import * as kubernetes from '@pulumi/kubernetes';
import { Volumes } from './volumes';

export interface ContainerSpec {
    name?: string;
    image: string;
    port?: number;
    ports?: { name: string; port: number; hostname?: string }[];
    commandArgs?: string[];
    env?: Record<string, string | undefined>;
    gpu?: boolean;
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
        args: {
            spec: ContainerSpec;
            metadata: kubernetes.types.input.meta.v1.ObjectMeta;
            serviceAccount: kubernetes.core.v1.ServiceAccount;
            volumes?: Volumes;
            affinity?: kubernetes.types.input.core.v1.Affinity;
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
                            this.spec.gpu || this.volumes?.hasLocal()
                                ? { privileged: true }
                                : undefined,
                        startupProbe: this.createProbe({ failureThreshold: 10 }),
                        volumeMounts: this.createVolumeMounts(),
                    },
                ],
                restartPolicy: this.spec.restartPolicy,
                serviceAccountName: this.serviceAccount.metadata.name,
                runtimeClassName: this.spec.gpu ? 'nvidia' : undefined,
                nodeSelector: this.spec.gpu ? { 'orangelab/gpu': 'true' } : undefined,
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
        return this.spec.gpu
            ? {
                  ...this.spec.resources,
                  requests: {
                      ...this.spec.resources?.requests,
                      'nvidia.com/gpu': '1',
                  },
                  limits: {
                      ...this.spec.resources?.limits,
                      'nvidia.com/gpu': '1',
                  },
              }
            : this.spec.resources;
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
