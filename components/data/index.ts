import * as pulumi from '@pulumi/pulumi';
import { CloudNativePG } from './cloudnative-pg/cloudnative-pg';
import { MariaDBOperator } from './mariadb-operator/mariadb-operator';
import { config } from '@orangelab/config';

export class DataModule extends pulumi.ComponentResource {
    cloudNativePG?: CloudNativePG;
    mariaDBOperator?: MariaDBOperator;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:data', name, {}, opts);

        const systemAlias = pulumi.interpolate`urn:pulumi:${pulumi.getStack()}::${pulumi.getProject()}::orangelab:system::system`;

        if (config.isEnabled('cloudnative-pg')) {
            this.cloudNativePG = new CloudNativePG('cloudnative-pg', {
                parent: this,
                aliases: [
                    { type: 'orangelab:system:CloudNativePG', parent: systemAlias },
                ],
            });
        }

        if (config.isEnabled('mariadb-operator')) {
            this.mariaDBOperator = new MariaDBOperator('mariadb-operator', {
                parent: this,
                aliases: [
                    { type: 'orangelab:system:MariaDBOperator', parent: systemAlias },
                ],
            });
        }
    }
}
