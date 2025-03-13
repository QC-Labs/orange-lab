import * as kubernetes from '@pulumi/kubernetes';
import { PersistentStorage } from './persistent-storage';

export interface ContainerSpec {
    name?: string;
    image: string;
    port?: number;
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
}

export class Containers {
    metadata: kubernetes.types.input.meta.v1.ObjectMeta;
    serviceAccount: kubernetes.core.v1.ServiceAccount;
    storage?: PersistentStorage;
    spec: ContainerSpec;
    affinity?: kubernetes.types.input.core.v1.Affinity;
    localStorage?: { name: string; hostPath: string };

    constructor(
        private appName: string,
        args: {
            spec: ContainerSpec;
            metadata: kubernetes.types.input.meta.v1.ObjectMeta;
            serviceAccount: kubernetes.core.v1.ServiceAccount;
            storage?: PersistentStorage;
            affinity?: kubernetes.types.input.core.v1.Affinity;
            localStorage?: { name: string; hostPath: string };
        },
    ) {
        this.spec = args.spec;
        this.metadata = args.metadata;
        this.serviceAccount = args.serviceAccount;
        this.storage = args.storage;
        this.affinity = args.affinity;
        this.localStorage = args.localStorage;
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
                            this.spec.gpu || this.localStorage
                                ? { privileged: true }
                                : undefined,
                        startupProbe: this.createProbe({ failureThreshold: 10 }),
                        volumeMounts: this.createVolumeMounts(),
                    },
                ],
                serviceAccountName: this.serviceAccount.metadata.name,
                runtimeClassName: this.spec.gpu ? 'nvidia' : undefined,
                nodeSelector: this.spec.gpu ? { 'orangelab/gpu': 'true' } : undefined,
                volumes: this.createVolumes(),
            },
        };
    }

    private createPorts() {
        return this.spec.port
            ? [
                  {
                      name: 'http',
                      containerPort: this.spec.port,
                      protocol: 'TCP',
                  },
              ]
            : [];
    }

    private createVolumes() {
        const localVolume = this.localStorage
            ? {
                  name: this.localStorage.name,
                  hostPath: { path: this.localStorage.hostPath },
              }
            : undefined;
        const persistentVolume = this.storage
            ? {
                  name: this.appName,
                  persistentVolumeClaim: {
                      claimName: this.storage.volumeClaimName,
                  },
              }
            : undefined;
        return [localVolume, persistentVolume].filter(v => v !== undefined);
    }

    private createVolumeMounts() {
        return (this.spec.volumeMounts ?? []).map(volumeMount => ({
            name: volumeMount.name ?? this.appName,
            mountPath: volumeMount.mountPath,
            subPath: volumeMount.subPath,
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
