import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export interface KubeAiArgs {
    domainName: string;
}

export class KubeAi extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    constructor(name: string, args: KubeAiArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:KubeAi', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');
        const hostname = config.require('hostname');
        const huggingfaceToken = config.getSecret('huggingfaceToken');

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'kubeai',
                namespace: 'kubeai',
                createNamespace: true,
                version,
                repositoryOpts: {
                    repo: 'https://www.kubeai.org',
                },
                values: {
                    secrets: {
                        huggingface: {
                            token: huggingfaceToken,
                        },
                    },
                    modelServerPods: {
                        // required for NVidia detection
                        securityContext: {
                            privileged: true,
                            allowPrivilegeEscalation: true,
                        },
                    },
                    openwebui: {
                        enabled: false,
                    },
                    nodeSelector: {
                        'orangelab/gpu': 'true',
                    },
                    ingress: {
                        enabled: true,
                        className: 'tailscale',
                        rules: [
                            {
                                host: hostname,
                                paths: [
                                    { path: '/', pathType: 'ImplementationSpecific' },
                                ],
                            },
                        ],
                        tls: [{ hosts: [hostname] }],
                    },
                    resourceProfiles: {
                        nvidia: {
                            runtimeClassName: 'nvidia',
                            nodeSelector: {
                                'orangelab/gpu': 'true',
                                'nvidia.com/gpu.present': 'true',
                            },
                        },
                    },
                },
            },
            { parent: this },
        );

        new kubernetes.helm.v3.Release(
            `${name}-models`,
            {
                chart: 'models',
                namespace: 'kubeai',
                createNamespace: true,
                version,
                repositoryOpts: {
                    repo: 'https://www.kubeai.org',
                },
                values: {
                    // Preconfigured models at https://github.com/substratusai/kubeai/blob/main/charts/models/values.yaml
                    catalog: {
                        'qwen2.5-coder-1.5b-cpu': {
                            enabled: true,
                            resourceProfile: 'nvidia:1',
                            // model downloaded on first request
                            minReplicas: 0,
                        },
                        'llama-3.1-8b-instruct-cpu': {
                            enabled: true,
                            resourceProfile: 'nvidia:1',
                            // model downloaded on first request, requires Hugginface token
                            minReplicas: 0,
                        },
                    },
                },
            },
            { parent: this },
        );

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.kubeai/openai/v1`;
    }
}
