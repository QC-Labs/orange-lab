import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { PersistentStorage, PersistentStorageType } from '../persistent-storage';

export interface OllamaArgs {
    domainName: string;
}

export class Ollama extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    constructor(name: string, args: OllamaArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Ollama', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');
        const hostname = config.require('hostname');

        const namespace = new kubernetes.core.v1.Namespace(
            'ns',
            {
                metadata: { name },
            },
            { parent: this },
        );

        const storage = new PersistentStorage(
            name,
            {
                name,
                namespace: namespace.metadata.name,
                size: '30Gi',
                type: PersistentStorageType.GPU,
            },
            { parent: this },
        );

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'ollama',
                namespace: namespace.metadata.name,
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
                        existingClaim: storage.volumeClaimName,
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

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.ollama:11434`;
    }
}
