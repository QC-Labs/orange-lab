import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { PersistentStorage, PersistentStorageType } from '../persistent-storage';

export interface SDNextArgs {
    domainName: string;
}

export class SDNext extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    private readonly port = 7860;
    readonly deployment: kubernetes.apps.v1.Deployment | undefined;
    readonly namespace: kubernetes.core.v1.Namespace;
    readonly storage: PersistentStorage;
    readonly serviceAccount: kubernetes.core.v1.ServiceAccount | undefined;
    readonly service: kubernetes.core.v1.Service | undefined;
    readonly appLabels = { app: 'sdnext' };
    readonly ingress: kubernetes.networking.v1.Ingress | undefined;

    constructor(private name: string, args: SDNextArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:SDNext', name, args, opts);

        const config = new pulumi.Config(name);
        const hostname = config.require('hostname');
        const cliArgs = config.require('cliArgs');
        const storageSize = config.require('storageSize');
        const storageOnly = config.requireBoolean('storageOnly');

        this.namespace = this.createNamespace();
        this.storage = this.createStorage(storageSize);
        if (storageOnly) return;

        this.serviceAccount = this.createServiceAccount();
        this.deployment = this.createDeployment(cliArgs);
        this.service = this.createService();
        this.ingress = this.createIngress(hostname);

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.${this.name}:${this.port.toString()}`;
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
                type: PersistentStorageType.GPU,
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

    private createDeployment(cliArgs: string) {
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
                            containers: [
                                {
                                    args: [
                                        '--listen',
                                        '--docs',
                                        '--skip-requirements',
                                        '--skip-extensions',
                                        '--skip-git',
                                        '--skip-torch',
                                        '--quick',
                                        cliArgs,
                                    ],
                                    env: [
                                        {
                                            name: 'SD_DEBUG',
                                            value: 'true',
                                        },
                                    ],
                                    image: `saladtechnologies/sdnext:base`,
                                    livenessProbe: {
                                        httpGet: {
                                            path: '/',
                                            port: 'http',
                                        },
                                    },
                                    name: this.name,
                                    ports: [
                                        {
                                            name: 'http',
                                            containerPort: this.port,
                                            protocol: 'TCP',
                                        },
                                    ],
                                    readinessProbe: {
                                        httpGet: {
                                            path: '/',
                                            port: 'http',
                                        },
                                    },
                                    securityContext: {
                                        privileged: true,
                                    },
                                    volumeMounts: [
                                        {
                                            name: this.name,
                                            mountPath: '/webui/data',
                                        },
                                    ],
                                },
                            ],
                            serviceAccountName: this.serviceAccount?.metadata.name,
                            runtimeClassName: 'nvidia',
                            nodeSelector: {
                                'orangelab/gpu': 'true',
                            },
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
}
