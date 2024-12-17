import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export interface OllamaArgs {
    domainName: string;
}

// Homepage: https://ollama.com/
// Helm chart: https://artifacthub.io/packages/helm/ollama-helm/ollama
export class Ollama extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;

    constructor(name: string, args: OllamaArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Ollama', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');
        const hostname = config.require('hostname');

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'ollama',
                namespace: 'ollama',
                createNamespace: true,
                version,
                repositoryOpts: {
                    repo: 'https://otwld.github.io/ollama-helm/',
                },
                values: {
                    nodeSelector: {
                        'orangelab/gpu': 'true',
                    },
                    runtimeClassName: 'nvidia',
                    extraEnv: [
                        {
                            name: 'NVIDIA_VISIBLE_DEVICES',
                            value: 'all',
                        },
                        {
                            name: 'NVIDIA_DRIVER_CAPABILITIES',
                            value: 'compute,utility',
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

        this.registerOutputs();
    }
}
