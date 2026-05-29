import { Application, config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export class SDNext extends pulumi.ComponentResource {
    app: Application;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:SDNext', name, {}, opts);

        const cliArgs = config.require(name, 'cliArgs');

        this.app = new Application(this, name).addStorage();

        this.app.addDeployment({
            ports: [{ name: 'http', port: 7860 }],
            commandArgs: [
                '--listen',
                '--docs',
                '--skip-requirements',
                '--skip-extensions',
                '--skip-git',
                '--skip-torch',
                '--quick',
                cliArgs,
            ],
            env: {
                SD_DEBUG: this.app.debug ? 'true' : 'false',
                SD_USEROCM: this.app.nodes.getGpu() === 'amd' ? 'True' : undefined,
            },
            volumeMounts: [{ mountPath: '/webui/data' }],
            resources: { requests: { cpu: '50m', memory: '2.5Gi' } },
        });
    }
}
