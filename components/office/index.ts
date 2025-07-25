import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { Nextcloud } from './nextcloud';

export class OfficeModule extends pulumi.ComponentResource {
    private readonly nextcloud?: Nextcloud;

    getExports() {
        return {
            endpoints: {
                nextcloud: this.nextcloud?.serviceUrl,
            },
            nextcloud: {
                users: this.nextcloud?.users,
                db: this.nextcloud?.dbConfig,
            },
        };
    }

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super('orangelab:office', name, {}, opts);

        if (rootConfig.isEnabled('nextcloud')) {
            this.nextcloud = new Nextcloud('nextcloud', { parent: this });
        }
    }
}
