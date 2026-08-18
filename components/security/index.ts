import { config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';
import { Pocket } from './pocket/pocket';

export class SecurityModule extends pulumi.ComponentResource {
    pocket: Pocket | undefined;

    getExports() {
        return {
            endpoints: {
                ...this.pocket?.app.network.endpoints,
                pocketOidc: this.pocket?.oidcProviderUrl,
            },
        };
    }

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super('orangelab:security', name, {}, opts);

        if (config.isEnabled('pocket')) {
            this.pocket = new Pocket('pocket', { parent: this });
        }
    }
}
