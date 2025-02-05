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
    deamonSet: kubernetes.apps.v1.DaemonSet | undefined;

    private config: pulumi.Config;
    private hostname: string;
    private storageOnly = false;
    private storageSize: string | undefined;
    private storageType: PersistentStorageType | undefined;
    private labels: { app: string };
    private port: number | undefined;
    private https: boolean | undefined;
    private deploymentArgs: DeploymentArgs | undefined;
    private deamonSetArgs: DeploymentArgs | undefined;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly name: string,
        private readonly params: { domainName: string },
    ) {
        this.config = new pulumi.Config(name);
        this.labels = { app: name };
        this.namespace = this.createNamespace();
        this.hostname = this.config.require('hostname');
    }

    withStorage(args?: { size?: string; type?: PersistentStorageType }) {
        this.storageSize = args?.size ?? this.config.get('storageSize');
        this.storageType = args?.type;
        this.storageOnly = this.config.get('storageOnly')?.toLowerCase() === 'true';
        return this;
    }

    withService(args: { port: number; https?: boolean }) {
        this.port = args.port;
        this.https = args.https;
        return this;
    }

    withDeployment(args: DeploymentArgs) {
        this.deploymentArgs = args;
        return this;
    }
    withDeamonSet(args: DeploymentArgs) {
        this.deamonSetArgs = args;
        return this;
    }

    create() {
        this.storage = this.storageSize ? this.createStorage() : undefined;
        if (this.storageOnly) return;
        this.service = this.port
            ? this.createService(this.namespace, this.port)
            : undefined;
        this.ingress = this.https
            ? this.createIngress(this.namespace, this.hostname)
            : undefined;
        this.serviceAccount = this.createServiceAccount(this.namespace);
        this.deployment = this.deploymentArgs
            ? this.createDeployment(this.namespace, this.deploymentArgs)
            : undefined;
        this.deamonSet = this.deamonSetArgs
            ? this.createDeamonSet(this.namespace, this.deamonSetArgs)
            : undefined;

        this.endpointUrl = this.https
            ? `https://${this.hostname}.${this.params.domainName}`
            : undefined;
        this.serviceUrl = this.port
            ? `http://${this.hostname}.${this.name}:${this.port.toString()}`
            : undefined;
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

    private createStorage(): PersistentStorage {
        return new PersistentStorage(
            `${this.name}-storage`,
            {
                name: this.name,
                namespace: this.namespace.metadata.name,
                size: this.storageSize ?? '5Gi',
                type: this.storageType ?? PersistentStorageType.Default,
            },
            { parent: this.scope },
        );
    }

    private createServiceAccount(namespace: kubernetes.core.v1.Namespace) {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.name}-sa`,
            {
                metadata: {
                    name: this.name,
                    namespace: namespace.metadata.name,
                    labels: this.labels,
                },
            },
            { parent: this.scope },
        );
    }

    private createService(namespace: kubernetes.core.v1.Namespace, port: number) {
        return new kubernetes.core.v1.Service(
            `${this.name}-svc`,
            {
                metadata: {
                    name: this.name,
                    namespace: namespace.metadata.name,
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

    private createIngress(namespace: kubernetes.core.v1.Namespace, hostname: string) {
        if (!this.service || !this.port) return undefined;
        return new kubernetes.networking.v1.Ingress(
            `${this.name}-ingress`,
            {
                metadata: {
                    name: this.name,
                    namespace: namespace.metadata.name,
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
                                                port: { number: this.port },
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

    private createDeployment(
        namespace: kubernetes.core.v1.Namespace,
        args: DeploymentArgs,
    ) {
        assert(args.port, 'port required for deployments');
        return new kubernetes.apps.v1.Deployment(
            `${this.name}-deployment`,
            {
                metadata: { name: this.name, namespace: namespace.metadata.name },
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

    private createDeamonSet(
        namespace: kubernetes.core.v1.Namespace,
        args: DeploymentArgs,
    ) {
        assert(args.name, 'name is required for deamonset');
        const deamonSetName = `${this.name}-${args.name}`;
        return new kubernetes.apps.v1.DaemonSet(
            `${deamonSetName}-deamonset`,
            {
                metadata: {
                    name: deamonSetName,
                    namespace: namespace.metadata.name,
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
