import { config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';
import { Longhorn } from './longhorn/longhorn';
import { Rustfs } from './rustfs/rustfs';

export class StorageModule extends pulumi.ComponentResource {
    longhorn?: Longhorn;
    rustfs?: Rustfs;

    getExports() {
        return {
            endpoints: {
                ...this.rustfs?.app.network.endpoints,
                longhorn: this.longhorn?.endpointUrl,
            },
            clusterEndpoints: {
                ...this.rustfs?.app.network.clusterEndpoints,
            },
            rustfsUsers: this.rustfs?.users,
        };
    }

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:storage', name, args, {
            ...opts,
            aliases: [{ type: 'orangelab:system' }],
        });

        const systemAlias = pulumi.interpolate`urn:pulumi:${pulumi.getStack()}::${pulumi.getProject()}::orangelab:system::system`;

        if (config.isEnabled('rustfs')) {
            this.rustfs = new Rustfs('rustfs', {
                parent: this,
                aliases: [{ type: 'orangelab:system:Rustfs', parent: systemAlias }],
            });
        }

        if (config.isEnabled('longhorn')) {
            this.longhorn = new Longhorn(
                'longhorn',
                {
                    s3Provisioner: this.rustfs?.s3Provisioner,
                },
                {
                    parent: this,
                    aliases: [{ type: 'orangelab:system:Longhorn', parent: systemAlias }],
                },
            );
        }
    }
}
