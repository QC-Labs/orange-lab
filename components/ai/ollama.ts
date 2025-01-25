import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { PersistentStorage, PersistentStorageType } from '../persistent-storage';

export interface OllamaArgs {
    domainName: string;
}

export class Ollama extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    readonly namespace: kubernetes.core.v1.Namespace;
    readonly storage: PersistentStorage;

    constructor(private name: string, args: OllamaArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Ollama', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');
        const hostname = config.require('hostname');
        const storageSize = config.require('storageSize');
        const storageOnly = config.requireBoolean('storageOnly');

        this.namespace = this.createNamespace();
        this.storage = this.createStorage(storageSize);
        if (storageOnly) return;

        this.createHelmRelease(version, hostname);

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.ollama:11434`;
    }

    private createHelmRelease(version: string, hostname: string) {
        new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'ollama',
                namespace: this.namespace.metadata.name,
                version,
                repositoryOpts: {
                    repo: 'https://otwld.github.io/ollama-helm/',
                },
                values: {
                    fullnameOverride: 'ollama',
                    securityContext: {
                        privileged: true,
                    },
                    nodeSelector: {
                        'orangelab/gpu': 'true',
                    },
                    runtimeClassName: 'nvidia',
                    extraEnv: [
                        {
                            name: 'OLLAMA_DEBUG',
                            value: 'false',
                        },
                    ],
                    ollama: {
                        gpu: {
                            enabled: true,
                            type: 'nvidia',
                            number: 1,
                        },
                        models: {
                            pull: [],
                        },
                    },
                    persistentVolume: {
                        enabled: true,
                        existingClaim: this.storage.volumeClaimName,
                    },
                    ingress: {
                        enabled: true,
                        className: 'tailscale',
                        hosts: [
                            {
                                host: hostname,
                                paths: [{ path: '/', pathType: 'Prefix' }],
                            },
                        ],
                        tls: [{ hosts: [hostname] }],
                    },
                },
            },
            { parent: this },
        );
    }

    private createStorage(storageSize: string) {
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

    private createNamespace() {
        return new kubernetes.core.v1.Namespace(
            `${this.name}-ns`,
            {
                metadata: { name: this.name },
            },
            { parent: this },
        );
    }
}
