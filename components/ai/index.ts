import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { Automatic1111 } from './automatic1111';
import { KubeAi } from './kubeai';
import { Ollama } from './ollama';
import { OpenWebUI } from './open-webui';
import { SDNext } from './sdnext';
import { InvokeAi } from './invokeai';
import { N8n } from './n8n';

interface AIModuleArgs {
    domainName: string;
}

export class AIModule extends pulumi.ComponentResource {
    private readonly ollama?: Ollama;
    private readonly kubeAI?: KubeAi;
    private readonly openWebUI?: OpenWebUI;
    private readonly automatic1111?: Automatic1111;
    private readonly sdnext?: SDNext;
    private readonly invokeAi?: InvokeAi;
    private readonly n8n?: N8n;

    getExports() {
        return {
            endpoints: {
                ...this.automatic1111?.app.network.endpoints,
                ...this.invokeAi?.app.network.endpoints,
                kubeai: this.kubeAI?.serviceUrl,
                ollama: this.ollama?.endpointUrl,
                'open-webui': this.openWebUI?.endpointUrl,
                ...this.sdnext?.app.network.endpoints,
                ...this.n8n?.app.network.endpoints,
            },
            clusterEndpoints: {
                ...this.automatic1111?.app.network.clusterEndpoints,
                ...this.invokeAi?.app.network.clusterEndpoints,
                kubeai: this.kubeAI?.serviceUrl,
                ollama: this.ollama?.serviceUrl,
                ...this.sdnext?.app.network.clusterEndpoints,
                ...this.n8n?.app.network.clusterEndpoints,
            },
            n8n: this.n8n
                ? {
                      encryptionKey: this.n8n.encryptionKey,
                      db: this.n8n.postgresConfig,
                  }
                : undefined,
        };
    }

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
                        this.sdnext?.app.network.clusterEndpoints.sdnext ??
                        this.automatic1111?.app.network.clusterEndpoints.automatic1111,
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

        if (rootConfig.isEnabled('n8n')) {
            this.n8n = new N8n(
                'n8n',
                { domainName: args.domainName, ollamaUrl: this.ollama?.serviceUrl },
                { parent: this },
            );
        }
    }
}
