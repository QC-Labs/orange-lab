import * as pulumi from '@pulumi/pulumi';
import * as kubernetes from '@pulumi/kubernetes';
import { PersistentStorage, PersistentStorageType } from './persistent-storage';
import assert from 'node:assert';
import { LimitRange } from '@pulumi/kubernetes/core/v1';
import { PodTemplateSpecBuilder } from './pod-template-spec';
import { ContainerSpec } from './interfaces';
import { Metadata } from './metadata';
import { Nodes } from './nodes';

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
    readonly metadata: Metadata;
    readonly namespace: kubernetes.core.v1.Namespace;
    readonly nodes: Nodes;

    storage?: PersistentStorage;
    service?: kubernetes.core.v1.Service;
    serviceAccount?: kubernetes.core.v1.ServiceAccount;
    ingress?: kubernetes.networking.v1.Ingress;
    deployment?: kubernetes.apps.v1.Deployment;
    daemonSet?: kubernetes.apps.v1.DaemonSet;

    private config: pulumi.Config;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        private readonly params?: { domainName?: string; namespaceName?: string },
    ) {
        this.config = new pulumi.Config(appName);
        this.storageOnly = this.config.getBoolean('storageOnly') ?? false;
        this.namespace = this.createNamespace(params?.namespaceName);
        this.metadata = new Metadata(appName, {
            config: this.config,
            namespace: this.namespace,
        });
        this.nodes = new Nodes(this.config);
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

        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
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
        assert(this.serviceAccount, 'serviceAccount is required');
        const podSpec = new PodTemplateSpecBuilder(this.appName, {
            spec: args,
            metadata: this.metadata.get(),
            storage: this.storage,
            serviceAccount: this.serviceAccount,
            affinity: this.nodes.getAffinity(),
        });
        return new kubernetes.apps.v1.Deployment(
            `${this.appName}-deployment`,
            {
                metadata: this.metadata.get(),
                spec: {
                    replicas: 1,
                    selector: { matchLabels: this.metadata.getSelectorLabels() },
                    template: podSpec.create(),
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
        const podSpec = new PodTemplateSpecBuilder(this.appName, {
            spec: args,
            metadata,
            storage: this.storage,
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
                    template: podSpec.create(),
                },
            },
            { parent: this.scope },
        );
    }
}
