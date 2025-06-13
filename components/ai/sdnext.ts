import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';

export interface SDNextArgs {
    domainName: string;
}

export class SDNext extends pulumi.ComponentResource {
    app: Application;

    constructor(name: string, args: SDNextArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:SDNext', name, args, opts);

        const config = new pulumi.Config(name);
        const cliArgs = config.require('cliArgs');
        const amdGpu = config.get('amd-gpu');

        this.app = new Application(this, name, {
            domainName: args.domainName,
            gpu: true,
        })
            .addStorage({ type: StorageType.GPU })
            .addDeployment({
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
                    SD_USEROCM: amdGpu ? 'True' : undefined,
                },
                volumeMounts: [{ mountPath: '/webui/data' }],
                resources: { requests: { cpu: '50m', memory: '2.5Gi' } },
            });
    }
}
