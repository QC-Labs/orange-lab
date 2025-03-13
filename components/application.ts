import * as kubernetes from '@pulumi/kubernetes';
import { LimitRange } from '@pulumi/kubernetes/core/v1';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Containers, ContainerSpec } from './containers';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import { PersistentStorage, PersistentStorageType } from './persistent-storage';

/**
 * Application class provides DSL (Domain Specific Language) to simplify creation of Kubernetes manifests.
 *
 * The `add*` methods use "fluent interface" to allow provisioning resources through "method chaining".
 * Pulumi resources are created here and other classes are used to create Kubernetes manifests without side-effects.
 *
 * Limitations:
 * - only one Deployment supported
 * - max one endpoint for Deployment
 * - max one DaemonSet
 * - no endpoints for DaemonSet
 * - persistent storage for DaemonSets not supported
 * - only one local host storage path for deployment supported
 */
export class Application {
    endpointUrl?: string;
    serviceUrl?: string;
    storageOnly = false;
    readonly metadata: Metadata;
    readonly nodes: Nodes;
    storage?: PersistentStorage;
    namespaceName: string;

    private readonly namespace?: kubernetes.core.v1.Namespace;
    private readonly config: pulumi.Config;
    private service?: kubernetes.core.v1.Service;
    private serviceAccount?: kubernetes.core.v1.ServiceAccount;
    private ingress?: kubernetes.networking.v1.Ingress;
    private deployment?: kubernetes.apps.v1.Deployment;
    private daemonSet?: kubernetes.apps.v1.DaemonSet;
    private localStoragePath?: string;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        private readonly args?: {
            domainName?: string;
            namespaceName?: string;
            existingNamespace?: string;
        },
    ) {
        this.config = new pulumi.Config(appName);
        this.storageOnly = this.config.getBoolean('storageOnly') ?? false;
        if (args?.existingNamespace) {
            this.namespaceName = args.existingNamespace;
        } else {
            this.namespaceName = args?.namespaceName ?? appName;
            this.namespace = this.createNamespace(this.namespaceName);
        }
        this.metadata = new Metadata(appName, {
            config: this.config,
            namespace: this.namespaceName,
        });
        this.nodes = new Nodes(this.config);
    }

    addStorage(args?: {
        size?: string;
        type?: PersistentStorageType;
        existingVolume?: string;
        cloneExistingClaim?: string;
    }) {
        this.storage = new PersistentStorage(
            `${this.appName}-storage`,
            {
                name: this.appName,
                namespace: this.namespaceName,
                size: args?.size ?? this.config.require('storageSize'),
                type: args?.type ?? PersistentStorageType.Default,
                storageClass: this.config.get('storageClass'),
                existingVolume: args?.existingVolume,
                cloneExistingClaim: args?.cloneExistingClaim,
            },
            { parent: this.scope },
        );
        return this;
    }

    addLocalStorage(hostPath: string) {
        this.localStoragePath = hostPath;
        return this;
    }

    addDeployment(args: ContainerSpec) {
        if (this.storageOnly) return this;
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        this.deployment = this.createDeployment(args);
        if (args.port) this.createEndpoint(args);
        return this;
    }

    addDeamonSet(args: ContainerSpec) {
        if (this.storageOnly) return this;
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        this.daemonSet = this.createDaemonSet(args);
        return this;
    }

    addDefaultLimits(args: {
        request?: Record<string, string>;
        limit?: Record<string, string>;
    }) {
        new LimitRange(
            `${this.appName}-limits`,
            {
                metadata: this.metadata.get(),
                spec: {
                    limits: [
                        {
                            type: 'Container',
                            defaultRequest: args.request,
                            default: args.limit,
                        },
                    ],
                },
            },
            { parent: this.scope },
        );
        return this;
    }

    private createEndpoint(args: ContainerSpec) {
        assert(args.port, 'port is required');
        assert(this.args?.domainName, 'domainName is required');
        const hostname = this.config.require('hostname');
        this.service = this.createService(args.port);
        const port = args.port.toString();
        this.serviceUrl = `http://${hostname}.${this.appName}:${port}`;
        this.ingress = this.createIngress(this.service, hostname);
        this.endpointUrl = `https://${hostname}.${this.args.domainName}`;
    }

    private createNamespace(name: string) {
        return new kubernetes.core.v1.Namespace(
            `${this.appName}-ns`,
            { metadata: { name } },
            { parent: this.scope },
        );
    }

    private createServiceAccount() {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.appName}-sa`,
            { metadata: this.metadata.get() },
            { parent: this.scope },
        );
    }

    private createService(port: number) {
        return new kubernetes.core.v1.Service(
            `${this.appName}-svc`,
            {
                metadata: this.metadata.get(),
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
                    selector: this.metadata.getSelectorLabels(),
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
                metadata: this.metadata.get(),
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
                                        pathType: 'Prefix',
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
        assert(this.serviceAccount, 'serviceAccount is required');
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata: this.metadata.get(),
            storage: this.storage,
            serviceAccount: this.serviceAccount,
            affinity: this.nodes.getAffinity(),
            localStoragePath: this.localStoragePath,
        });
        return new kubernetes.apps.v1.Deployment(
            `${this.appName}-deployment`,
            {
                metadata: this.metadata.get(),
                spec: {
                    replicas: 1,
                    selector: { matchLabels: this.metadata.getSelectorLabels() },
                    template: podSpec.createPodTemplateSpec(),
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
        assert(this.serviceAccount, 'serviceAccount is required');
        const metadata = this.metadata.getForComponent(args.name);
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata,
            serviceAccount: this.serviceAccount,
        });
        return new kubernetes.apps.v1.DaemonSet(
            `${this.appName}-${args.name}-daemonset`,
            {
                metadata,
                spec: {
                    selector: {
                        matchLabels: this.metadata.getSelectorLabels(args.name),
                    },
                    template: podSpec.createPodTemplateSpec(),
                },
            },
            { parent: this.scope },
        );
    }
}
