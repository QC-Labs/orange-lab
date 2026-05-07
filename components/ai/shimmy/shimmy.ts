import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';

export class Shimmy extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly serviceUrl?: string;

    private readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:ai:Shimmy', name, {}, opts);

        const hostname = config.require(name, 'hostname');

        this.app = new Application(this, name).addStorage();

        if (this.app.storageOnly) return;

        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();
        const amdGpu = this.app.gpu === 'amd';
        const gfxVersion = config.get(this.name, 'HSA_OVERRIDE_GFX_VERSION');
        const amdTargets = config.get(this.name, 'HCC_AMDGPU_TARGETS');

        const imageTag = config.get(this.name, 'image') ?? 'latest';
        const commandArgs = ['serve', '--bind', '0.0.0.0:11434'];
        if (!this.app.gpu) {
            commandArgs.push('--gpu-backend', 'cpu');
        } else {
            commandArgs.push('--gpu-backend', 'auto');
        }

        this.app.addDeployment({
            ports: [{ name: 'http', port: 11434 }],
            volumeMounts: [{ mountPath: '/app/models' }],
            commandArgs,
            image: `ghcr.io/michael-a-kuykendall/shimmy:${imageTag}`,
            resources: {
                requests: { memory: '512Mi' },
                limits: { memory: '2Gi' },
            },
            env: {
                RUST_LOG: this.app.debug ? 'debug' : 'info',
                SHIMMY_PORT: '11434',
                SHIMMY_HOST: '0.0.0.0',
                SHIMMY_BASE_GGUF: '/app/models',
                HSA_OVERRIDE_GFX_VERSION: amdGpu && gfxVersion ? gfxVersion : undefined,
                HCC_AMDGPU_TARGETS: amdGpu && amdTargets ? amdTargets : undefined,
            },
            healthChecks: true,
        });

        this.endpointUrl = httpEndpointInfo.url;
        this.serviceUrl = `http://${hostname}.shimmy:11434`;
    }
}
