import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { PersistentStorageType } from '../persistent-storage';

export interface SDNextArgs {
    domainName: string;
}

export class SDNext extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    constructor(name: string, args: SDNextArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:SDNext', name, args, opts);

        const config = new pulumi.Config(name);
        const cliArgs = config.require('cliArgs');

        const app = new Application(this, name, { domainName: args.domainName })
            .withStorage({
                type: PersistentStorageType.GPU,
            })
            .withService({ port: 7860, https: true })
            .withDeployment({
                image: 'saladtechnologies/sdnext:base',
                port: 7860,
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
                    SD_DEBUG: 'true',
                },
                gpu: true,
                healthChecks: true,
                volumeMounts: [{ mountPath: '/webui/data' }],
            });
        app.create();
        this.endpointUrl = app.endpointUrl;
        this.serviceUrl = app.serviceUrl;
    }
}
