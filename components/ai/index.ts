import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { KubeAi } from './kubeai';
import { Ollama } from './ollama';
import { OpenWebUI } from './open-webui';

interface AIModuleArgs {
    domainName: string;
}

export class AIModule extends pulumi.ComponentResource {
    ollamaUrl: string | undefined;
    kubeAIUrl: string | undefined;
    openWebUIUrl: string | undefined;

    private ollama: Ollama | undefined;
    private kubeAI: KubeAi | undefined;
    private openWebUI: OpenWebUI | undefined;

    constructor(
        name: string,
        args: AIModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:ai', name, args, opts);

        if (rootConfig.isEnabled('ollama')) {
            this.ollama = new Ollama(
                'ollama',
                {
                    domainName: args.domainName,
                },
                { parent: this },
            );
            this.ollamaUrl = this.ollama.endpointUrl;
        }

        if (rootConfig.isEnabled('kubeai')) {
            this.kubeAI = new KubeAi(
                'kubeai',
                {
                    domainName: args.domainName,
                },
                { parent: this },
            );
            this.kubeAIUrl = this.kubeAI.serviceUrl;
        }

        if (rootConfig.isEnabled('open-webui')) {
            this.openWebUI = new OpenWebUI(
                'open-webui',
                {
                    domainName: args.domainName,
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
}
