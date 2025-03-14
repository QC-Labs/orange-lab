import * as kubernetes from '@pulumi/kubernetes';
import { LimitRange } from '@pulumi/kubernetes/core/v1';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Containers, ContainerSpec } from './containers';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import { LocalVolume, PersistentVolume, Volumes } from './volumes';

/**
 * Application class provides DSL (Domain Specific Language) to simplify creation of Kubernetes manifests.
 *
 * Limitations:
 * - only one Deployment supported
 * - max one endpoint for Deployment
 * - max one DaemonSet
 * - no endpoints for DaemonSet
 * - persistent storage for DaemonSets not supported
 */
export class Application {
    endpointUrl?: string;
    serviceUrl?: string;
    storageOnly = false;
    readonly metadata: Metadata;
    readonly nodes: Nodes;
    readonly volumes: Volumes;
    readonly namespace: string;

    private readonly config: pulumi.Config;
    private serviceAccount?: kubernetes.core.v1.ServiceAccount;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        private readonly args?: {
            domainName?: string;
            namespace?: string;
            existingNamespace?: string;
        },
    ) {
        this.config = new pulumi.Config(appName);
        this.storageOnly = this.config.getBoolean('storageOnly') ?? false;
        if (args?.existingNamespace) {
            this.namespace = args.existingNamespace;
        } else {
            this.namespace = args?.namespace ?? appName;
            this.createNamespace(this.namespace);
        }
        this.metadata = new Metadata(appName, {
            config: this.config,
            namespace: this.namespace,
        });
        this.nodes = new Nodes(this.config);
        this.volumes = new Volumes(appName, {
            scope: this.scope,
            config: this.config,
            namespace: this.namespace,
        });
    }

    addStorage(volume?: PersistentVolume) {
        this.volumes.addPersistentVolume(volume);
        return this;
    }

    addLocalStorage(volume: LocalVolume) {
        this.volumes.addLocalVolume(volume);
        return this;
    }

    addDeployment(args: ContainerSpec) {
        if (this.storageOnly) return this;
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        this.createDeployment(args);
        if (args.port) this.createEndpoint(args);
        return this;
    }

    addDeamonSet(args: ContainerSpec) {
        if (this.storageOnly) return this;
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        this.createDaemonSet(args);
        return this;
    }

    addJob(args: ContainerSpec) {
        if (this.storageOnly) return this;
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        this.createJob(args);
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
        const service = this.createService(args.port);
        const port = args.port.toString();
        this.serviceUrl = `http://${hostname}.${this.appName}:${port}`;
        this.createIngress(service, hostname);
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
            volumes: this.volumes,
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
                    template: podSpec.createPodTemplateSpec(),
                    strategy: this.volumes.hasVolumes()
                        ? { type: 'Recreate', rollingUpdate: undefined }
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

    private createJob(args: ContainerSpec) {
        assert(args.name, 'name is required for job');
        assert(this.serviceAccount, 'serviceAccount is required');
        const metadata = this.metadata.getForComponent(args.name);
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata,
            volumes: this.volumes,
            serviceAccount: this.serviceAccount,
            affinity: this.nodes.getAffinity(),
        });
        return new kubernetes.batch.v1.Job(
            `${this.appName}-${args.name}-job`,
            {
                metadata,
                spec: {
                    template: podSpec.createPodTemplateSpec(),
                },
            },
            { parent: this.scope },
        );
    }
}
