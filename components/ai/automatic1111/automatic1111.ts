import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';

export class Automatic1111 extends pulumi.ComponentResource {
    app: Application;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Automatic1111', name, {}, opts);

        const cliArgs = config.require(name, 'cliArgs');

        this.app = new Application(this, name).addStorage().addDeployment({
            commandArgs: ['--listen', '--api', '--skip-torch-cuda-test'],
            env: {
                COMMANDLINE_ARGS: cliArgs,
            },
            ports: [{ name: 'http', port: 8080 }],
            runAsUser: 1000,
            volumeOwnerUserId: 1000,
            volumeMounts: [
                {
                    mountPath: '/app/stable-diffusion-webui/models',
                    subPath: 'models',
                },
                {
                    mountPath: '/app/stable-diffusion-webui/extensions',
                    subPath: 'extensions',
                },
                {
                    mountPath: '/app/stable-diffusion-webui/outputs',
                    subPath: 'outputs',
                },
            ],
            resources: {
                requests: { cpu: '100m', memory: '2Gi' },
            },
        });
    }
}
