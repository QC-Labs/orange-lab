import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { Application } from '@orangelab/application';
import { StorageType } from '@orangelab/types';

export interface OpenWebUIArgs {
    ollamaUrl?: string;
    openAiUrl?: string;
    automatic1111Url?: pulumi.Input<string>;
}

export class OpenWebUI extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;

    constructor(
        private name: string,
        args: OpenWebUIArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:ai:OpenWebUI', name, args, opts);

        const config = new pulumi.Config(name);
        const hostname = config.require('hostname');
        const appVersion = config.get('appVersion');
        const amdGpu = config.get('amd-gpu');
        const debug = config.get('debug');
        const DEFAULT_MODELS = config.get('DEFAULT_MODELS') ?? '';
        const DEFAULT_USER_ROLE = config.require('DEFAULT_USER_ROLE');

        const app = new Application(this, name).addStorage({ type: StorageType.GPU });

        if (app.storageOnly) return;

        const ingresInfo = app.network.getIngressInfo(hostname);
        const isTailscale = ingresInfo.className === 'tailscale';
        this.endpointUrl = ingresInfo.url;
        app.addHelmChart(
            name,
            {
                chart: 'open-webui',
                repo: 'https://helm.openwebui.com/',
                values: {
                    affinity: app.nodes.getAffinity(),
                    containerSecurityContext: amdGpu ? undefined : { privileged: true },
                    extraEnvVars: [
                        { name: 'AUTOMATIC1111_BASE_URL', value: args.automatic1111Url },
                        { name: 'BYPASS_MODEL_ACCESS_CONTROL', value: 'True' },
                        { name: 'DEFAULT_MODELS', value: DEFAULT_MODELS },
                        { name: 'DEFAULT_USER_ROLE', value: DEFAULT_USER_ROLE },
                        { name: 'ENABLE_ADMIN_CHAT_ACCESS', value: 'False' },
                        { name: 'ENABLE_EVALUATION_ARENA_MODELS', value: 'False' },
                        {
                            name: 'ENABLE_IMAGE_GENERATION',
                            value: args.automatic1111Url ? 'True' : 'False',
                        },
                        {
                            name: 'ENABLE_LOGIN_FORM',
                            value: isTailscale ? 'False' : 'True',
                        },
                        { name: 'ENABLE_PERSISTENT_CONFIG', value: 'False' },
                        { name: 'ENABLE_SEARCH_QUERY_GENERATION', value: 'True' },
                        { name: 'ENABLE_SIGNUP', value: 'True' },
                        { name: 'ENABLE_VERSION_UPDATE_CHECK', value: 'False' },
                        { name: 'ENABLE_WEB_SEARCH', value: 'True' },
                        { name: 'IMAGE_GENERATION_ENGINE', value: 'automatic1111' },
                        { name: 'USE_CUDA_DOCKER', value: amdGpu ? 'False' : 'True' },
                        { name: 'USE_OLLAMA_DOCKER', value: 'False' },
                        {
                            name: 'USER_PERMISSIONS_FEATURES_DIRECT_TOOL_SERVERS',
                            value: 'True',
                        },
                        {
                            name: 'USER_PERMISSIONS_WORKSPACE_KNOWLEDGE_ACCESS',
                            value: 'True',
                        },
                        {
                            name: 'USER_PERMISSIONS_WORKSPACE_MODELS_ACCESS',
                            value: 'True',
                        },
                        {
                            name: 'USER_PERMISSIONS_WORKSPACE_PROMPTS_ACCESS',
                            value: 'True',
                        },
                        {
                            name: 'USER_PERMISSIONS_WORKSPACE_TOOLS_ACCESS',
                            value: 'True',
                        },
                        { name: 'WEB_SEARCH_ENGINE', value: 'duckduckgo' },
                        { name: 'WEBUI_AUTH', value: isTailscale ? 'False' : 'True' },
                        ...(isTailscale
                            ? [
                                  {
                                      name: 'WEBUI_AUTH_TRUSTED_EMAIL_HEADER',
                                      value: 'Tailscale-User-Login',
                                  },
                                  {
                                      name: 'WEBUI_AUTH_TRUSTED_NAME_HEADER',
                                      value: 'Tailscale-User-Name',
                                  },
                              ]
                            : []),
                        { name: 'WEBUI_SECRET_KEY', value: this.createSecretKey() },
                        { name: 'WEBUI_URL', value: ingresInfo.url },
                    ],
                    image: { tag: appVersion },
                    ingress: {
                        enabled: true,
                        class: ingresInfo.className,
                        host: ingresInfo.hostname,
                        tls: ingresInfo.tls,
                        annotations: ingresInfo.annotations,
                    },
                    logging: { level: debug ? 'debug' : 'info' },
                    ollama: { enabled: false },
                    ollamaUrls: [args.ollamaUrl],
                    openaiBaseApiUrl: args.openAiUrl,
                    persistence: {
                        enabled: true,
                        existingClaim: app.storage?.getClaimName(),
                    },
                    pipelines: { enabled: false },
                    runtimeClassName: amdGpu ? undefined : 'nvidia',
                    websocket: {
                        redis: {
                            affinity: app.nodes.getAffinity(),
                        },
                    },
                },
            },
            { dependsOn: app.storage },
        );
    }

    private createSecretKey() {
        return new random.RandomPassword(
            `${this.name}-secret-key`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
