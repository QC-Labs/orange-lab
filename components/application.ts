import * as pulumi from '@pulumi/pulumi';
import * as kubernetes from '@pulumi/kubernetes';
import { PersistentStorage, PersistentStorageType } from './persistent-storage';
import assert from 'node:assert';

interface DeploymentArgs {
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
 * It uses "builder" pattern so you need to call "create()" at the end to create the resources.
 * The `with*` methods use "fluent interface" to allow modifying configuration state through "method chaining".
 *
 * Some standard configuration settings are supported:
 * - storageOnly
 * - storageSize
 * - hostname
 *
 * Limitations:
 * - only one Deployment type
 * - only one DaemonSet
 * - one Service and Ingress for Deployment
 * - no endpoints for DaemonSet
 */
export class Application {
    public endpointUrl: string | undefined;
    public serviceUrl: string | undefined;

    readonly namespace: kubernetes.core.v1.Namespace;
    storage: PersistentStorage | undefined;
    service: kubernetes.core.v1.Service | undefined;
    serviceAccount: kubernetes.core.v1.ServiceAccount | undefined;
    ingress: kubernetes.networking.v1.Ingress | undefined;
    deployment: kubernetes.apps.v1.Deployment | undefined;
    daemonSet: kubernetes.apps.v1.DaemonSet | undefined;

    private config: pulumi.Config;
    private hostname: string;
    private storageOnly = false;
    private labels: { app: string };
    private deploymentArgs: DeploymentArgs | undefined;
    private daemonSetArgs: DeploymentArgs | undefined;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly name: string,
        private readonly params: { domainName: string },
    ) {
        this.config = new pulumi.Config(name);
        this.hostname = this.config.require('hostname');
        this.storageOnly = this.config.get('storageOnly')?.toLowerCase() === 'true';
        this.labels = { app: name };
        this.namespace = this.createNamespace();
        if (this.storageOnly) return;
        this.serviceAccount = this.createServiceAccount();
    }

    addStorage(args?: { size?: string; type?: PersistentStorageType }) {
        this.storage = new PersistentStorage(
            `${this.name}-storage`,
            {
                name: this.name,
                namespace: this.namespace.metadata.name,
                size: args?.size ?? this.config.require('storageSize'),
                type: args?.type ?? PersistentStorageType.Default,
            },
            { parent: this.scope },
        );
        return this;
    }

    withDeployment(args: DeploymentArgs) {
        this.deploymentArgs = args;
        return this;
    }
    withDeamonSet(args: DeploymentArgs) {
        this.daemonSetArgs = args;
        return this;
    }

    create() {
        if (this.storageOnly) return;
        if (this.deploymentArgs) {
            if (this.deploymentArgs.port) {
                this.service = this.createService(this.deploymentArgs.port);
                this.serviceUrl = `http://${this.hostname}.${
                    this.name
                }:${this.deploymentArgs.port.toString()}`;
                this.ingress = this.createIngress(
                    this.hostname,
                    this.deploymentArgs.port,
                );
                this.endpointUrl = `https://${this.hostname}.${this.params.domainName}`;
            }
            this.deployment = this.createDeployment(this.deploymentArgs);
        }
        if (this.daemonSetArgs) {
            this.daemonSet = this.createDaemonSet(this.daemonSetArgs);
        }
    }

    private createNamespace() {
        return new kubernetes.core.v1.Namespace(
            `${this.name}-ns`,
            {
                metadata: { name: this.name },
            },
            { parent: this.scope },
        );
    }

    private createServiceAccount() {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.name}-sa`,
            {
                metadata: {
                    name: this.name,
                    namespace: this.namespace.metadata.name,
                    labels: this.labels,
                },
            },
            { parent: this.scope },
        );
    }

    private createService(port: number) {
        return new kubernetes.core.v1.Service(
            `${this.name}-svc`,
            {
                metadata: {
                    name: this.name,
                    namespace: this.namespace.metadata.name,
                    labels: this.labels,
                },
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

    private createIngress(hostname: string, targetPort: number) {
        assert(this.service);
        return new kubernetes.networking.v1.Ingress(
            `${this.name}-ingress`,
            {
                metadata: {
                    name: this.name,
                    namespace: this.namespace.metadata.name,
                    labels: this.labels,
                },
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
                                                name: this.service.metadata.name,
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

    private createDeployment(args: DeploymentArgs) {
        assert(args.port, 'port required for deployments');
        return new kubernetes.apps.v1.Deployment(
            `${this.name}-deployment`,
            {
                metadata: { name: this.name, namespace: this.namespace.metadata.name },
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: this.labels,
                    },
                    template: this.createPodTemplateSpec(args),
                },
            },
            { parent: this.scope },
        );
    }

    private createDaemonSet(args: DeploymentArgs) {
        assert(args.name, 'name is required for daemonset');
        const deamonSetName = `${this.name}-${args.name}`;
        return new kubernetes.apps.v1.DaemonSet(
            `${deamonSetName}-daemonset`,
            {
                metadata: {
                    name: deamonSetName,
                    namespace: this.namespace.metadata.name,
                },
                spec: {
                    selector: {
                        matchLabels: this.labels,
                    },
                    template: this.createPodTemplateSpec(args),
                },
            },
            { parent: this.scope },
        );
    }

    private createPodTemplateSpec(
        args: DeploymentArgs,
    ): pulumi.Input<kubernetes.types.input.core.v1.PodTemplateSpec> {
        assert(this.serviceAccount);
        const env = Object.entries(args.env ?? {}).map(([key, value]) => ({
            name: key,
            value,
        }));
        const podName = args.name ? `${this.name}-${args.name}` : this.name;
        return {
            metadata: { name: podName, labels: this.labels },
            spec: {
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
                            name: this.name,
                            mountPath: volumeMount.mountPath,
                            subPath: volumeMount.subPath,
                        })),
                    },
                ],
                serviceAccountName: this.serviceAccount.metadata.name,
                runtimeClassName: args.gpu ? 'nvidia' : undefined,
                nodeSelector: args.gpu ? { 'orangelab/gpu': 'true' } : undefined,
                volumes:
                    this.storage && args.volumeMounts && args.volumeMounts.length > 0
                        ? [
                              {
                                  name: this.name,
                                  persistentVolumeClaim: {
                                      claimName: this.storage.volumeClaimName,
                                  },
                              },
                          ]
                        : [],
            },
        };
    }
}
