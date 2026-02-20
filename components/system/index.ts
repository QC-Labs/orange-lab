import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import { Debug } from './debug/debug';

export class SystemModule extends pulumi.ComponentResource {
    getExports() {
        return {
            tailscaleDomain: config.tailnetDomain,
        };
    }

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system', name, args, opts);

        if (config.isEnabled('debug')) {
            new Debug('debug', {}, { parent: this });
        }
    }
}
