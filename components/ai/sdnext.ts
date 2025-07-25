import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';

export class SDNext extends pulumi.ComponentResource {
    app: Application;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:SDNext', name, {}, opts);

        const config = new pulumi.Config(name);
        const cliArgs = config.require('cliArgs');
        const amdGpu = config.get('amd-gpu');
        const debug = config.getBoolean('debug') ?? false;

        this.app = new Application(this, name, { gpu: true })
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
                    SD_DEBUG: debug ? 'true' : 'false',
                    SD_USEROCM: amdGpu ? 'True' : undefined,
                },
                volumeMounts: [{ mountPath: '/webui/data' }],
                resources: { requests: { cpu: '50m', memory: '2.5Gi' } },
            });
    }
}
