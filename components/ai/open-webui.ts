import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export interface OpenWebUIArgs {
    domainName: string;
    ollamaUrl?: string;
    openAiUrl?: string;
    storageClass: string;
}

export class OpenWebUI extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;

    constructor(name: string, args: OpenWebUIArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:OpenWebUI', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');
        const hostname = config.require('hostname');

        this.endpointUrl = `https://${hostname}.${args.domainName}`;

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'open-webui',
                namespace: 'open-webui',
                createNamespace: true,
                version,
                repositoryOpts: {
                    repo: 'https://helm.openwebui.com/',
                },
                values: {
                    ollamaUrls: [args.ollamaUrl],
                    openaiBaseApiUrl: args.openAiUrl,
                    nodeSelector: {
                        'orangelab/gpu': 'true',
                    },
                    extraEnvVars: [
                        {
                            name: 'WEBUI_URL',
                            value: this.endpointUrl,
                        },
                        {
                            name: 'ENABLE_SIGNUP',
                            value: 'True',
                        },
                        {
                            name: 'BYPASS_MODEL_ACCESS_CONTROL',
                            value: 'True',
                        },
                        {
                            name: 'DEFAULT_USER_ROLE',
                            value: 'user',
                        },
                        {
                            name: 'ENABLE_EVALUATION_ARENA_MODELS',
                            value: 'False',
                        },
                        {
                            name: 'WEBUI_AUTH',
                            value: 'False',
                        },
                        {
                            name: 'WEBUI_AUTH_TRUSTED_EMAIL_HEADER',
                            value: 'Tailscale-User-Login',
                        },
                        {
                            name: 'WEBUI_AUTH_TRUSTED_NAME_HEADER',
                            value: 'Tailscale-User-Name',
                        },
                    ],
                    ollama: {
                        enabled: false,
                    },
                    persistence: {
                        enabled: true,
                        storageClass: args.storageClass,
                    },
                    pipelines: {
                        enabled: false,
                    },
                    ingress: {
                        enabled: true,
                        class: 'tailscale',
                        host: hostname,
                        tls: true,
                    },
                },
            },
            { parent: this },
        );
    }
}
