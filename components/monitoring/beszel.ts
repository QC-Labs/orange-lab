import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { PersistentStorage } from '../persistent-storage';

export interface BeszelArgs {
    domainName: string;
}

export class Beszel extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    private readonly port = 8090;
    private readonly agentPort = 45876;
    readonly deployment: kubernetes.apps.v1.Deployment | undefined;
    readonly namespace: kubernetes.core.v1.Namespace;
    readonly storage: PersistentStorage;
    readonly serviceAccount: kubernetes.core.v1.ServiceAccount | undefined;
    readonly service: kubernetes.core.v1.Service | undefined;
    readonly appLabels = { app: 'beszel' };
    readonly ingress: kubernetes.networking.v1.Ingress | undefined;

    constructor(private name: string, args: BeszelArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Beszel', name, args, opts);

        const config = new pulumi.Config(name);
        const hostname = config.require('hostname');
        const storageSize = config.require('storageSize');
        const storageOnly = config.requireBoolean('storageOnly');
        const hubKey = config.get('hubKey');

        this.namespace = this.createNamespace();
        this.storage = this.createStorage(storageSize);
        if (storageOnly) return;

        this.serviceAccount = this.createServiceAccount();
        this.deployment = this.createDeployment();
        this.service = this.createService();
        this.ingress = this.createIngress(hostname);
        if (hubKey) {
            this.createAgentDeployment(hubKey);
        }

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
    }

    private createIngress(hostname: string) {
        if (!this.service) return undefined;
        return new kubernetes.networking.v1.Ingress(
            `${this.name}-ingress`,
            {
                metadata: {
                    name: this.name,
                    namespace: this.namespace.metadata.name,
                    labels: this.appLabels,
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
            { parent: this },
        );
    }

    private createNamespace() {
        return new kubernetes.core.v1.Namespace(
            `${this.name}-ns`,
            {
                metadata: { name: this.name },
            },
            { parent: this },
        );
    }

    private createStorage(storageSize: string): PersistentStorage {
        return new PersistentStorage(
            `${this.name}-storage`,
            {
                name: this.name,
                namespace: this.namespace.metadata.name,
                size: storageSize,
            },
            { parent: this },
        );
    }

    private createServiceAccount() {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.name}-sa`,
            {
                metadata: {
                    name: this.name,
                    namespace: this.namespace.metadata.name,
                    labels: this.appLabels,
                },
            },
            { parent: this },
        );
    }

    private createService() {
        return new kubernetes.core.v1.Service(
            `${this.name}-svc`,
            {
                metadata: {
                    name: this.name,
                    namespace: this.namespace.metadata.name,
                    labels: this.appLabels,
                },
                spec: {
                    type: 'ClusterIP',
                    ports: [
                        {
                            name: 'http',
                            protocol: 'TCP',
                            port: this.port,
                            targetPort: this.port,
                        },
                    ],
                    selector: this.appLabels,
                },
            },
            { parent: this },
        );
    }

    private createDeployment() {
        return new kubernetes.apps.v1.Deployment(
            `${this.name}-deployment`,
            {
                metadata: { name: this.name, namespace: this.namespace.metadata.name },
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: this.appLabels,
                    },
                    template: {
                        metadata: {
                            name: this.name,
                            labels: this.appLabels,
                        },
                        spec: {
                            hostNetwork: true,
                            containers: [
                                {
                                    image: `henrygd/beszel:latest`,
                                    name: 'beszel',
                                    ports: [
                                        {
                                            name: 'http',
                                            containerPort: this.port,
                                            protocol: 'TCP',
                                        },
                                    ],
                                    volumeMounts: [
                                        {
                                            name: this.name,
                                            mountPath: '/beszel_data',
                                        },
                                    ],
                                    env: [
                                        {
                                            name: 'USER_CREATION',
                                            value: 'true',
                                        },
                                    ],
                                },
                            ],
                            serviceAccountName: this.serviceAccount?.metadata.name,
                            volumes: [
                                {
                                    name: this.name,
                                    persistentVolumeClaim: {
                                        claimName: this.storage.volumeClaimName,
                                    },
                                },
                            ],
                        },
                    },
                },
            },
            { parent: this },
        );
    }

    private createAgentDeployment(key: string) {
        return new kubernetes.apps.v1.DaemonSet(
            `${this.name}-agent`,
            {
                metadata: {
                    name: `${this.name}-agent`,
                    namespace: this.namespace.metadata.name,
                },
                spec: {
                    selector: {
                        matchLabels: this.appLabels,
                    },
                    template: {
                        metadata: {
                            name: this.name,
                            labels: this.appLabels,
                        },
                        spec: {
                            hostNetwork: true,
                            containers: [
                                {
                                    image: `henrygd/beszel-agent`,
                                    name: 'beszel-agent',
                                    env: [
                                        {
                                            name: 'PORT',
                                            value: this.agentPort.toString(),
                                        },
                                        {
                                            name: 'KEY',
                                            value: key,
                                        },
                                    ],
                                },
                            ],
                            serviceAccountName: this.serviceAccount?.metadata.name,
                        },
                    },
                },
            },
            { parent: this },
        );
    }
}
