import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import { Debug } from './debug/debug';

export class DevModule extends pulumi.ComponentResource {
    getExports() {
        return {};
    }

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:dev', name, args, opts);

        if (config.isEnabled('debug')) {
            new Debug('debug', {}, { parent: this });
        }
    }
}
