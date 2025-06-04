import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';

export interface VllmArgs {
    domainName: string;
}

export class Vllm extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly serviceUrl?: string;

    private readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(private name: string, args: VllmArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Vllm', name, args, opts);

        this.config = new pulumi.Config(name);
        const hostname = this.config.require('hostname');
        const model = this.config.require('model');
        const hfToken = this.config.getSecret('HUGGING_FACE_HUB_TOKEN');
        const amdGpu = this.config.getBoolean('amd-gpu');
        const debug = this.config.getBoolean('debug');

        this.app = new Application(this, name, {
            domainName: args.domainName,
            gpu: true,
        }).addStorage({ type: StorageType.GPU });

        if (this.app.storageOnly) return;

        this.app.addDeployment({
            image: amdGpu ? 'rocm/vllm:latest' : 'vllm/vllm-openai:latest',
            port: 8000,
            resources: { requests: { cpu: '1', memory: '4Gi' } },
            command: ['/bin/sh', '-c'],
            commandArgs: [
                `vllm serve ${
                    hfToken ? '--hf-token $(HUGGING_FACE_HUB_TOKEN)' : ''
                } ${model}`,
            ],
            envSecret: { HUGGING_FACE_HUB_TOKEN: hfToken },
            env: {
                VLLM_LOGGING_LEVEL: debug ? 'DEBUG' : 'INFO',
                VLLM_PORT: '8000',
            },
            volumeMounts: [{ mountPath: '/root/.cache/huggingface' }],
        });

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.${this.app.namespace}:8000`;
    }
}
