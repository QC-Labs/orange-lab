import * as pulumi from '@pulumi/pulumi';
import * as kubernetes from '@pulumi/kubernetes';
import { PersistentStorage, PersistentStorageType } from './persistent-storage';
import assert from 'node:assert';

interface ContainerSpec {
    name?: string;
    image: string;
    port?: number;
    commandArgs?: string[];
    env?: Record<string, string>;
    gpu?: boolean;
    hostNetwork?: boolean;
    volumeMounts?: { mountPath: string; subPath?: string }[];
    healthChecks?: boolean;
    resources?: kubernetes.types.input.core.v1.ResourceRequirements;
    runAsUser?: number;
}

/**
 * Application class provides DSL (Domain Specific Language) to simplify creation of Kubernetes manifests.
 *
 * Use of this class is optional.
 * The Kubernetes resources are NOT encapsulated and are accessible for reading by components.
 * This allows partial use and extensibility.
 *
 * The `add*` methods use "fluent interface" to allow provisioning resources through "method chaining".
 *
 * Limitations:
 * - only one Deployment supported
 * - one endpoint required for Deployment
 * - max one DaemonSet
 * - no endpoints for DaemonSet
 */
export class Application {
    public endpointUrl: string | undefined;
    public serviceUrl: string | undefined;
    public storageOnly = false;

    readonly namespace: kubernetes.core.v1.Namespace;
    storage?: PersistentStorage;
    service?: kubernetes.core.v1.Service;
    serviceAccount?: kubernetes.core.v1.ServiceAccount;
    ingress?: kubernetes.networking.v1.Ingress;
    deployment?: kubernetes.apps.v1.Deployment;
    daemonSet?: kubernetes.apps.v1.DaemonSet;

    private config: pulumi.Config;
    private labels: Record<string, string>;
    private requiredNodeLabel?: string;
    private preferredNodeLabel?: string;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        private readonly params?: { domainName?: string; namespaceName?: string },
    ) {
        this.config = new pulumi.Config(appName);
        const version = this.config.get('version');
        const appVersion = this.config.get('appVersion');
        this.storageOnly = this.config.getBoolean('storageOnly') ?? false;
        this.requiredNodeLabel = this.config.get('requiredNodeLabel');
        this.preferredNodeLabel = this.config.get('preferredNodeLabel');
        this.labels = {
            app: appName,
            'app.kubernetes.io/name': appName,
            'app.kubernetes.io/managed-by': 'OrangeLab',
        };
        if (version) {
            this.labels['app.kubernetes.io/version'] = appVersion ?? version;
        }
        this.namespace = this.createNamespace(params?.namespaceName);
        if (this.storageOnly) return;
    }

    addStorage(args?: { size?: string; type?: PersistentStorageType }) {
        this.storage = new PersistentStorage(
            `${this.appName}-storage`,
            {
                name: this.appName,
                namespace: this.namespace.metadata.name,
                size: args?.size ?? this.config.require('storageSize'),
                type: args?.type ?? PersistentStorageType.Default,
                storageClass: this.config.get('storageClass'),
            },
            { parent: this.scope },
        );
        return this;
    }

    addDeployment(args: ContainerSpec) {
        assert(this.params?.domainName, 'domainName is required');
        const hostname = this.config.require('hostname');
        if (this.storageOnly) return this;

        this.deployment = this.createDeployment(args);
        if (!args.port) return this;
        this.service = this.createService(args.port);
        const port = args.port.toString();
        this.serviceUrl = `http://${hostname}.${this.appName}:${port}`;
        this.ingress = this.createIngress(this.service, hostname);
        this.endpointUrl = `https://${hostname}.${this.params.domainName}`;
        return this;
    }

    addDeamonSet(args: ContainerSpec) {
        if (this.storageOnly) return this;
        this.daemonSet = this.createDaemonSet(args);
        return this;
    }

    getAffinity(): kubernetes.types.input.core.v1.Affinity | undefined {
        if (!this.requiredNodeLabel && !this.preferredNodeLabel) return;
        return {
            nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: this.requiredNodeLabel
                    ? {
                          nodeSelectorTerms: [
                              this.getNodeSelectorTerm(this.requiredNodeLabel),
                          ],
                      }
                    : undefined,
                preferredDuringSchedulingIgnoredDuringExecution: this.preferredNodeLabel
                    ? [
                          {
                              preference: this.getNodeSelectorTerm(
                                  this.preferredNodeLabel,
                              ),
                              weight: 1,
                          },
                      ]
                    : undefined,
            },
        };
    }

    private getNodeSelectorTerm(labelSpec: string) {
        const [key, value] = labelSpec.split('=');
        const match = value
            ? { key, operator: 'In', values: [value] }
            : { key, operator: 'Exists' };
        return { matchExpressions: [match] };
    }

    getMetadata() {
        return {
            name: this.appName,
            namespace: this.namespace.metadata.name,
            labels: this.labels,
        };
    }

    private createNamespace(name?: string) {
        return new kubernetes.core.v1.Namespace(
            `${this.appName}-ns`,
            { metadata: { name: name ?? this.appName } },
            { parent: this.scope },
        );
    }

    private createServiceAccount() {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.appName}-sa`,
            { metadata: this.getMetadata() },
            { parent: this.scope },
        );
    }

    private createService(port: number) {
        return new kubernetes.core.v1.Service(
            `${this.appName}-svc`,
            {
                metadata: this.getMetadata(),
                spec: {
                    type: 'ClusterIP',
                    ports: [
                        {
                            name: 'http',
                            protocol: 'TCP',
                            port,
                            targetPort: port,
                        },
                    ],
                    selector: this.labels,
                },
            },
            { parent: this.scope },
        );
    }

    private createIngress(service: kubernetes.core.v1.Service, hostname: string) {
        const serviceName = service.metadata.name;
        const targetPort = service.spec.ports[0].port;
        return new kubernetes.networking.v1.Ingress(
            `${this.appName}-ingress`,
            {
                metadata: this.getMetadata(),
                spec: {
                    ingressClassName: 'tailscale',
                    tls: [{ hosts: [hostname] }],
                    rules: [
                        {
                            host: hostname,
                            http: {
                                paths: [
                                    {
                                        path: '/',
                                        pathType: 'ImplementationSpecific',
                                        backend: {
                                            service: {
                                                name: serviceName,
                                                port: { number: targetPort },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
            { parent: this.scope },
        );
    }

    private createDeployment(args: ContainerSpec) {
        assert(args.port, 'port required for deployments');
        return new kubernetes.apps.v1.Deployment(
            `${this.appName}-deployment`,
            {
                metadata: this.getMetadata(),
                spec: {
                    replicas: 1,
                    selector: { matchLabels: { app: this.appName } },
                    template: this.createPodTemplateSpec(
                        args,
                        this.labels,
                        this.getAffinity(),
                    ),
                    strategy: this.storage
                        ? { type: 'Recreate' }
                        : { type: 'RollingUpdate' },
                },
            },
            { parent: this.scope, deleteBeforeReplace: true },
        );
    }

    private createDaemonSet(args: ContainerSpec) {
        assert(args.name, 'name is required for daemonset');
        const daemonSetName = `${this.appName}-${args.name}`;
        const labels = {
            ...this.labels,
            component: args.name,
            'app.kubernetes.io/component': args.name,
        };
        return new kubernetes.apps.v1.DaemonSet(
            `${daemonSetName}-daemonset`,
            {
                metadata: { ...this.getMetadata(), name: daemonSetName, labels },
                spec: {
                    selector: {
                        matchLabels: { app: this.appName, component: args.name },
                    },
                    template: this.createPodTemplateSpec(args, labels),
                },
            },
            { parent: this.scope },
        );
    }

    private createPodTemplateSpec(
        args: ContainerSpec,
        labels: Record<string, string>,
        affinity?: kubernetes.types.input.core.v1.Affinity,
    ): pulumi.Input<kubernetes.types.input.core.v1.PodTemplateSpec> {
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        const env = Object.entries(args.env ?? {}).map(([key, value]) => ({
            name: key,
            value,
        }));
        const podName = args.name ? `${this.appName}-${args.name}` : this.appName;
        return {
            metadata: {
                ...this.getMetadata(),
                name: podName,
                labels,
            },
            spec: {
                affinity,
                securityContext: args.runAsUser
                    ? {
                          runAsUser: args.runAsUser,
                          runAsGroup: args.runAsUser,
                          fsGroup: args.runAsUser,
                      }
                    : undefined,
                hostNetwork: args.hostNetwork,
                containers: [
                    {
                        args: args.commandArgs,
                        env,
                        image: args.image,
                        livenessProbe: args.healthChecks
                            ? { httpGet: { path: '/', port: 'http' } }
                            : undefined,
                        name: podName,
                        ports: args.port
                            ? [
                                  {
                                      name: 'http',
                                      containerPort: args.port,
                                      protocol: 'TCP',
                                  },
                              ]
                            : [],
                        readinessProbe: args.healthChecks
                            ? { httpGet: { path: '/', port: 'http' } }
                            : undefined,
                        resources: args.resources,
                        securityContext: args.gpu ? { privileged: true } : undefined,
                        volumeMounts: (args.volumeMounts ?? []).map(volumeMount => ({
                            name: this.appName,
                            mountPath: volumeMount.mountPath,
                            subPath: volumeMount.subPath,
                        })),
                    },
                ],
                serviceAccountName: this.serviceAccount.metadata.name,
                runtimeClassName: args.gpu ? 'nvidia' : undefined,
                nodeSelector: args.gpu ? { 'orangelab/gpu': 'true' } : undefined,
                volumes:
                    this.storage && args.volumeMounts
                        ? [
                              {
                                  name: this.appName,
                                  persistentVolumeClaim: {
                                      claimName: this.storage.volumeClaimName,
                                  },
                              },
                          ]
                        : undefined,
            },
        };
    }
}
