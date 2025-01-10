import * as pulumi from '@pulumi/pulumi';
import { KubeAi } from './ai/kubeai';
import { Ollama } from './ai/ollama';
import { OpenWebUI } from './ai/open-webui';

interface AIModuleArgs {
    domainName: string;
    gpuStorageClass: string;
}

export class AIModule extends pulumi.ComponentResource {
    ollamaUrl: string | undefined;
    kubeAIUrl: string | undefined;
    openWebUIUrl: string | undefined;

    private config = new pulumi.Config('orangelab');
    private ollama: Ollama | undefined;
    private kubeAI: KubeAi | undefined;
    private openWebUI: OpenWebUI | undefined;

    constructor(
        name: string,
        args: AIModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:ai', name, args, opts);

        if (this.isModuleEnabled('ollama')) {
            this.ollama = new Ollama(
                'ollama',
                {
                    domainName: args.domainName,
                    storageClass: args.gpuStorageClass,
                },
                { parent: this },
            );
            this.ollamaUrl = this.ollama.endpointUrl;
        }

        if (this.isModuleEnabled('kubeai')) {
            this.kubeAI = new KubeAi(
                'kubeai',
                {
                    domainName: args.domainName,
                },
                { parent: this },
            );
            this.kubeAIUrl = this.kubeAI.serviceUrl;
        }

        if (this.isModuleEnabled('open-webui')) {
            this.openWebUI = new OpenWebUI(
                'open-webui',
                {
                    domainName: args.domainName,
                    storageClass: args.gpuStorageClass,
                    ollamaUrl: this.ollama?.serviceUrl,
                    openAiUrl: this.kubeAI?.serviceUrl,
                },
                {
                    parent: this,
                    dependsOn: [this.ollama, this.kubeAI].filter(x => x !== undefined),
                },
            );
            this.openWebUIUrl = this.openWebUI.endpointUrl;
        }
    }

    public isModuleEnabled(name: string): boolean {
        return this.config.requireBoolean(name);
    }
}
