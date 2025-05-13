import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';

export interface InvokeAiArgs {
    domainName: string;
}

export class InvokeAi extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    constructor(name: string, args: InvokeAiArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:InvokeAi', name, args, opts);

        const config = new pulumi.Config(name);
        const huggingfaceToken = config.getSecret('huggingfaceToken');
        const imageTag = config.get('amd-gpu') ? 'main-rocm' : 'latest';

        const app = new Application(this, name, {
            domainName: args.domainName,
            gpu: true,
        })
            .addStorage({ type: StorageType.GPU })
            .addDeployment({
                image: `ghcr.io/invoke-ai/invokeai:${imageTag}`,
                port: 9090,
                env: {
                    INVOKEAI_ROOT: '/invokeai',
                    INVOKEAI_HOST: '0.0.0.0',
                    INVOKEAI_PORT: '9090',
                    INVOKEAI_ENABLE_PARTIAL_LOADING: 'true',
                    INVOKEAI_LOG_LEVEL: 'info',
                    INVOKEAI_REMOTE_API_TOKENS: huggingfaceToken
                        ? `[{"url_regex":"huggingface.co", "token": "${huggingfaceToken.get()}"}]`
                        : undefined,
                },
                healthChecks: true,
                volumeMounts: [{ mountPath: '/invokeai' }],
                resources: { requests: { cpu: '50m', memory: '1.5Gi' } },
            });

        this.endpointUrl = app.endpointUrl;
        this.serviceUrl = app.serviceUrl;
    }
}
