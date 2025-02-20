import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { PersistentStorageType } from '../persistent-storage';

export interface OpenWebUIArgs {
    domainName: string;
    ollamaUrl?: string;
    openAiUrl?: string;
    automatic1111Url?: string;
}

export class OpenWebUI extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;

    constructor(name: string, args: OpenWebUIArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:OpenWebUI', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.get('version');
        const hostname = config.require('hostname');
        const appVersion = config.get('appVersion');

        this.endpointUrl = `https://${hostname}.${args.domainName}`;

        const app = new Application(this, name, { domainName: args.domainName })
            .addDefaultLimits({ request: { cpu: '5m', memory: '1.2Gi' } })
            .addStorage({ type: PersistentStorageType.GPU });

        if (app.storageOnly) return;

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'open-webui',
                namespace: app.namespaceName,
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
                            name: 'ENABLE_RAG_WEB_SEARCH',
                            value: 'True',
                        },
                        {
                            name: 'ENABLE_SEARCH_QUERY_GENERATION',
                            value: 'True',
                        },
                        {
                            name: 'RAG_WEB_SEARCH_ENGINE',
                            value: 'duckduckgo',
                        },
                        {
                            name: 'ENABLE_IMAGE_GENERATION',
                            value: args.automatic1111Url ? 'True' : 'False',
                        },
                        {
                            name: 'IMAGE_GENERATION_ENGINE',
                            value: 'automatic1111',
                        },
                        {
                            name: 'AUTOMATIC1111_BASE_URL',
                            value: args.automatic1111Url,
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
                    image: {
                        tag: appVersion,
                    },
                    persistence: {
                        enabled: true,
                        existingClaim: app.storage?.volumeClaimName,
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
