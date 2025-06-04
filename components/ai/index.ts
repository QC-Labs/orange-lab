import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { Automatic1111 } from './automatic1111';
import { KubeAi } from './kubeai';
import { Ollama } from './ollama';
import { OpenWebUI } from './open-webui';
import { SDNext } from './sdnext';
import { InvokeAi } from './invokeai';
import { Vllm } from './vllm';

interface AIModuleArgs {
    domainName: string;
}

export class AIModule extends pulumi.ComponentResource {
    ollama?: Ollama;
    kubeAI?: KubeAi;
    openWebUI?: OpenWebUI;
    automatic1111?: Automatic1111;
    sdnext?: SDNext;
    invokeAi?: InvokeAi;
    vllm?: Vllm;

    constructor(
        name: string,
        args: AIModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:ai', name, args, opts);
        const enableMonitoring = rootConfig.enableMonitoring();

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
                { domainName: args.domainName },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('sdnext')) {
            this.sdnext = new SDNext(
                'sdnext',
                { domainName: args.domainName },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('kubeai')) {
            this.kubeAI = new KubeAi(
                'kubeai',
                { domainName: args.domainName, enableMonitoring },
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

        if (rootConfig.isEnabled('invokeai')) {
            this.invokeAi = new InvokeAi(
                'invokeai',
                { domainName: args.domainName },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('vllm')) {
            this.vllm = new Vllm(
                'vllm',
                { domainName: args.domainName },
                { parent: this },
            );
        }
    }
}
