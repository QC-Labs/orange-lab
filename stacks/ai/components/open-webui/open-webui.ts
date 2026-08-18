import { Application, config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export interface OpenWebUIArgs {
    ollamaUrl?: string;
    openAiUrl?: string;
    automatic1111Url?: pulumi.Input<string>;
}

export class OpenWebUI extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly secretKey: pulumi.Output<string>;
    private readonly app: Application;

    constructor(
        private name: string,
        args: OpenWebUIArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:ai:OpenWebUI', name, args, opts);

        this.app = new Application(this, name).addStorage();
        this.secretKey = pulumi.output(
            config.get(name, 'WEBUI_SECRET_KEY') ?? this.app.createPassword('secret-key'),
        );

        if (this.app.storageOnly) return;

        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();
        const isTailscale = httpEndpointInfo.className === 'tailscale';
        this.endpointUrl = httpEndpointInfo.url;

        const openidProviderUrl = config.get(name, 'OPENID_PROVIDER_URL');
        const enableOidc = openidProviderUrl !== undefined;
        const oauthClientId = enableOidc ? config.require(name, 'OAUTH_CLIENT_ID') : undefined;
        const oauthClientSecret = enableOidc
            ? config.requireSecret(name, 'OAUTH_CLIENT_SECRET')
            : undefined;

        const env: Record<string, pulumi.Input<string> | undefined> = {
            AUTOMATIC1111_BASE_URL: args.automatic1111Url,
            BYPASS_MODEL_ACCESS_CONTROL: 'True',
            DEFAULT_MODELS: config.get(name, 'DEFAULT_MODELS') ?? '',
            DEFAULT_USER_ROLE: config.require(name, 'DEFAULT_USER_ROLE'),
            ENABLE_ADMIN_CHAT_ACCESS: 'False',
            ENABLE_EVALUATION_ARENA_MODELS: 'False',
            ENABLE_IMAGE_GENERATION: args.automatic1111Url ? 'True' : 'False',
            ENABLE_LOGIN_FORM: isTailscale || enableOidc ? 'False' : 'True',
            ENABLE_PASSWORD_AUTH: enableOidc ? 'False' : 'True',
            ENABLE_PERSISTENT_CONFIG: 'False',
            ENABLE_SEARCH_QUERY_GENERATION: 'True',
            ENABLE_SIGNUP: enableOidc ? 'False' : 'True',
            ENABLE_VERSION_UPDATE_CHECK: 'False',
            ENABLE_WEB_SEARCH: 'True',
            IMAGE_GENERATION_ENGINE: 'automatic1111',
            LOG_LEVEL: this.app.debug ? 'debug' : undefined,
            OLLAMA_BASE_URLS: args.ollamaUrl,
            OPENAI_BASE_API_URL: args.openAiUrl,
            USER_PERMISSIONS_FEATURES_DIRECT_TOOL_SERVERS: 'True',
            USER_PERMISSIONS_WORKSPACE_KNOWLEDGE_ACCESS: 'True',
            USER_PERMISSIONS_WORKSPACE_MODELS_ACCESS: 'True',
            USER_PERMISSIONS_WORKSPACE_PROMPTS_ACCESS: 'True',
            USER_PERMISSIONS_WORKSPACE_TOOLS_ACCESS: 'True',
            USE_CUDA_DOCKER: this.app.nodes.getGpu() === 'nvidia' ? 'True' : 'False',
            USE_OLLAMA_DOCKER: 'False',
            WEBUI_AUTH: isTailscale ? 'False' : 'True',
            WEBUI_URL: httpEndpointInfo.url,
            WEB_SEARCH_ENGINE: 'duckduckgo',
        };

        if (isTailscale) {
            env.WEBUI_AUTH_TRUSTED_EMAIL_HEADER = 'Tailscale-User-Login';
            env.WEBUI_AUTH_TRUSTED_NAME_HEADER = 'Tailscale-User-Name';
        }

        if (enableOidc) {
            env.ENABLE_OAUTH_SIGNUP = 'True';
            env.OAUTH_CLIENT_ID = oauthClientId;
            env.OAUTH_MERGE_ACCOUNTS_BY_EMAIL = 'True';
            env.OAUTH_PROVIDER_NAME = config.get(name, 'OAUTH_PROVIDER_NAME') ?? 'SSO';
            env.OAUTH_UPDATE_PICTURE_ON_LOGIN = 'True';
            env.OPENID_PROVIDER_URL = openidProviderUrl;
        }

        this.app.addDeployment({
            ports: [{ name: 'http', port: 8080 }],
            volumeMounts: [{ mountPath: '/app/backend/data' }],
            env,
            envSecret: {
                OAUTH_CLIENT_SECRET: oauthClientSecret,
                WEBUI_SECRET_KEY: this.secretKey,
            },
            healthCheck: { httpGet: { path: '/health' } },
        });
    }

}
