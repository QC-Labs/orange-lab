import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { Automatic1111 } from './automatic1111';
import { KubeAi } from './kubeai';
import { Ollama } from './ollama';
import { OpenWebUI } from './open-webui';
import { SDNext } from './sdnext';

interface AIModuleArgs {
    domainName: string;
}

export class AIModule extends pulumi.ComponentResource {
    ollama: Ollama | undefined;
    kubeAI: KubeAi | undefined;
    openWebUI: OpenWebUI | undefined;
    automatic1111: Automatic1111 | undefined;
    sdnext: SDNext | undefined;

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
        }

        if (rootConfig.isEnabled('automatic1111')) {
            this.automatic1111 = new Automatic1111(
                'automatic1111',
                {
                    domainName: args.domainName,
                },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('sdnext')) {
            this.sdnext = new SDNext(
                'sdnext',
                {
                    domainName: args.domainName,
                },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('kubeai')) {
            this.kubeAI = new KubeAi(
                'kubeai',
                {
                    domainName: args.domainName,
                },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('open-webui')) {
            this.openWebUI = new OpenWebUI(
                'open-webui',
                {
                    domainName: args.domainName,
                    ollamaUrl: this.ollama?.serviceUrl,
                    openAiUrl: this.kubeAI?.serviceUrl,
                    automatic1111Url:
                        this.sdnext?.serviceUrl ?? this.automatic1111?.serviceUrl,
                },
                {
                    parent: this,
                    dependsOn: [this.ollama, this.kubeAI, this.automatic1111].filter(
                        x => x !== undefined,
                    ),
                },
            );
        }
    }
}
