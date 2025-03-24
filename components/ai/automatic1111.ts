import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { PersistentStorageType } from '../persistent-storage';

export interface Automatic1111Args {
    domainName: string;
}

export class Automatic1111 extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    constructor(
        private name: string,
        args: Automatic1111Args,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:ai:Automatic1111', name, args, opts);

        const config = new pulumi.Config(name);
        const cliArgs = config.require('cliArgs');

        const app = new Application(this, name, {
            domainName: args.domainName,
            gpu: true,
        })
            .addStorage({ type: PersistentStorageType.GPU })
            .addDeployment({
                image: 'universonic/stable-diffusion-webui:full',
                commandArgs: ['--listen', '--api'],
                env: {
                    COMMANDLINE_ARGS: cliArgs,
                },
                gpu: true,
                port: 8080,
                runAsUser: 1000,
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

        this.endpointUrl = app.endpointUrl;
        this.serviceUrl = app.serviceUrl;
    }
}
