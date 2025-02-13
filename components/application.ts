import * as pulumi from '@pulumi/pulumi';
import * as kubernetes from '@pulumi/kubernetes';
import { PersistentStorage, PersistentStorageType } from './persistent-storage';
import assert from 'node:assert';
import { LimitRange } from '@pulumi/kubernetes/core/v1';
import { PodTemplateSpecBuilder } from './pod-template-spec';
import { ContainerSpec } from './interfaces';

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

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        private readonly params?: { domainName?: string; namespaceName?: string },
    ) {
        this.config = new pulumi.Config(appName);
        this.storageOnly = this.config.getBoolean('storageOnly') ?? false;
        this.labels = this.createLabels();
        this.namespace = this.createNamespace(params?.namespaceName);
    }

    private createLabels() {
        const labels = {
            app: this.appName,
            'app.kubernetes.io/name': this.appName,
            'app.kubernetes.io/managed-by': 'OrangeLab',
        };
        const version = this.config.get('version');
        const appVersion = this.config.get('appVersion');
        if (version) {
            this.labels['app.kubernetes.io/version'] = appVersion ?? version;
        }
        return labels;
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
                metadata: this.getMetadata(),
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

    getAffinity(): kubernetes.types.input.core.v1.Affinity | undefined {
        const requiredNodeLabel = this.config.get('requiredNodeLabel');
        const preferredNodeLabel = this.config.get('preferredNodeLabel');
        if (!requiredNodeLabel && !preferredNodeLabel) return;

        const getNodeSelectorTerm = (labelSpec: string) => {
            const [key, value] = labelSpec.split('=');
            const match = value
                ? { key, operator: 'In', values: [value] }
                : { key, operator: 'Exists' };
            return { matchExpressions: [match] };
        };

        return {
            nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: requiredNodeLabel
                    ? {
                          nodeSelectorTerms: [getNodeSelectorTerm(requiredNodeLabel)],
                      }
                    : undefined,
                preferredDuringSchedulingIgnoredDuringExecution: preferredNodeLabel
                    ? [
                          {
                              preference: getNodeSelectorTerm(preferredNodeLabel),
                              weight: 1,
                          },
                      ]
                    : undefined,
            },
        };
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
        assert(this.serviceAccount, 'serviceAccount is required');
        const podSpec = new PodTemplateSpecBuilder(this.appName, {
            spec: args,
            metadata: this.getMetadata(),
            storage: this.storage,
            serviceAccount: this.serviceAccount,
            affinity: this.getAffinity(),
        });
        return new kubernetes.apps.v1.Deployment(
            `${this.appName}-deployment`,
            {
                metadata: this.getMetadata(),
                spec: {
                    replicas: 1,
                    selector: { matchLabels: { app: this.appName } },
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
        const daemonSetName = `${this.appName}-${args.name}`;
        const labels = {
            ...this.labels,
            component: args.name,
            'app.kubernetes.io/component': args.name,
        };
        const metadata = { ...this.getMetadata(), name: daemonSetName, labels };
        const podSpec = new PodTemplateSpecBuilder(this.appName, {
            spec: args,
            metadata,
            storage: this.storage,
            serviceAccount: this.serviceAccount,
        });
        return new kubernetes.apps.v1.DaemonSet(
            `${daemonSetName}-daemonset`,
            {
                metadata,
                spec: {
                    selector: {
                        matchLabels: { app: this.appName, component: args.name },
                    },
                    template: podSpec.create(),
                },
            },
            { parent: this.scope },
        );
    }
}
