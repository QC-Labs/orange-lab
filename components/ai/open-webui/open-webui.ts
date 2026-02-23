import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

export interface OpenWebUIArgs {
    ollamaUrl?: string;
    openAiUrl?: string;
    automatic1111Url?: pulumi.Input<string>;
}

export class OpenWebUI extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly secretKey: pulumi.Output<string>;

    constructor(
        private name: string,
        args: OpenWebUIArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:ai:OpenWebUI', name, args, opts);

        this.secretKey = pulumi.output(
            config.get(name, 'WEBUI_SECRET_KEY') ?? this.createSecretKey(),
        );

        const app = new Application(this, name).addStorage();
        if (app.storageOnly) return;

        const httpEndpointInfo = app.network.getHttpEndpointInfo();
        const isTailscale = httpEndpointInfo.className === 'tailscale';
        this.endpointUrl = httpEndpointInfo.url;

        const env: Record<string, pulumi.Input<string> | undefined> = {
            AUTOMATIC1111_BASE_URL: args.automatic1111Url,
            BYPASS_MODEL_ACCESS_CONTROL: 'True',
            DEFAULT_MODELS: config.get(name, 'DEFAULT_MODELS') ?? '',
            DEFAULT_USER_ROLE: config.require(name, 'DEFAULT_USER_ROLE'),
            ENABLE_ADMIN_CHAT_ACCESS: 'False',
            ENABLE_EVALUATION_ARENA_MODELS: 'False',
            ENABLE_IMAGE_GENERATION: args.automatic1111Url ? 'True' : 'False',
            ENABLE_LOGIN_FORM: isTailscale ? 'False' : 'True',
            ENABLE_PERSISTENT_CONFIG: 'False',
            ENABLE_SEARCH_QUERY_GENERATION: 'True',
            ENABLE_SIGNUP: 'True',
            ENABLE_VERSION_UPDATE_CHECK: 'False',
            ENABLE_WEB_SEARCH: 'True',
            IMAGE_GENERATION_ENGINE: 'automatic1111',
            OLLAMA_BASE_URLS: args.ollamaUrl,
            OPENAI_BASE_API_URL: args.openAiUrl,
            USER_PERMISSIONS_FEATURES_DIRECT_TOOL_SERVERS: 'True',
            USER_PERMISSIONS_WORKSPACE_KNOWLEDGE_ACCESS: 'True',
            USER_PERMISSIONS_WORKSPACE_MODELS_ACCESS: 'True',
            USER_PERMISSIONS_WORKSPACE_PROMPTS_ACCESS: 'True',
            USER_PERMISSIONS_WORKSPACE_TOOLS_ACCESS: 'True',
            USE_CUDA_DOCKER: app.gpu === 'nvidia' ? 'True' : 'False',
            USE_OLLAMA_DOCKER: 'False',
            WEBUI_AUTH: isTailscale ? 'False' : 'True',
            WEBUI_URL: httpEndpointInfo.url,
            WEB_SEARCH_ENGINE: 'duckduckgo',
        };

        if (isTailscale) {
            env.WEBUI_AUTH_TRUSTED_EMAIL_HEADER = 'Tailscale-User-Login';
            env.WEBUI_AUTH_TRUSTED_NAME_HEADER = 'Tailscale-User-Name';
        }

        app.addDeployment({
            ports: [{ name: 'http', port: 8080 }],
            volumeMounts: [{ mountPath: '/app/backend/data' }],
            env,
            envSecret: {
                WEBUI_SECRET_KEY: this.secretKey,
            },
            healthChecks: true,
        });
    }

    private createSecretKey() {
        return new random.RandomPassword(
            `${this.name}-secret-key`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
