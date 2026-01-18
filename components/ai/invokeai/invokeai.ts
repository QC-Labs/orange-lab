import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { StorageType } from '../../types';

export class InvokeAi extends pulumi.ComponentResource {
    app: Application;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:InvokeAi', name, {}, opts);

        const config = new pulumi.Config(name);
        const debug = config.getBoolean('debug') ?? false;
        const huggingfaceToken = config.getSecret('huggingfaceToken');
        const imageTag = config.get('amd-gpu') ? 'main-rocm' : 'latest';

        this.app = new Application(this, name, { gpu: true })
            .addStorage({ type: StorageType.GPU })
            .addDeployment({
                image: `ghcr.io/invoke-ai/invokeai:${imageTag}`,
                port: 9090,
                env: {
                    INVOKEAI_ROOT: '/invokeai',
                    INVOKEAI_HOST: '0.0.0.0',
                    INVOKEAI_PORT: '9090',
                    INVOKEAI_ENABLE_PARTIAL_LOADING: 'true',
                    INVOKEAI_LOG_LEVEL: debug ? 'debug' : 'info',
                    INVOKEAI_REMOTE_API_TOKENS: huggingfaceToken
                        ? `[{"url_regex":"huggingface.co", "token": "${huggingfaceToken.get()}"}]`
                        : undefined,
                },
                healthChecks: true,
                volumeMounts: [{ mountPath: '/invokeai' }],
                resources: { requests: { cpu: '50m', memory: '1.5Gi' } },
            });
    }
}
