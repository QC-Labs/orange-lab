import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export interface OpenWebUIArgs {
    ollamaUrl?: string;
}

// Homepage: https://openwebui.com/
// Helm chart: https://artifacthub.io/packages/helm/open-webui/open-webui
export class OpenWebUI extends pulumi.ComponentResource {
    public readonly serverKey: pulumi.Output<string> | undefined;
    public readonly agentKey: pulumi.Output<string> | undefined;

    constructor(name: string, args: OpenWebUIArgs = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:OpenWebUI', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');
        const hostname = config.require('hostname');

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
                    nodeSelector: {
                        'orangelab/gpu': 'true',
                    },
                    extraEnvVars: [
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

        this.registerOutputs();
    }
}
