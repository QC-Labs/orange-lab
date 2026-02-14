import * as pulumi from '@pulumi/pulumi';
import { config } from '@orangelab/config';
import { Vaultwarden } from './vaultwarden/vaultwarden';

export class SecurityModule extends pulumi.ComponentResource {
    private readonly vaultwarden?: Vaultwarden;

    getExports() {
        return {
            endpoints: {
                vaultwarden: this.vaultwarden?.serviceUrl,
            },
            clusterEndpoints: {},
            vaultwarden: this.vaultwarden
                ? {
                      adminToken: this.vaultwarden.adminToken,
                  }
                : undefined,
        };
    }

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super('orangelab:security', name, {}, opts);

        if (config.isEnabled('vaultwarden')) {
            this.vaultwarden = new Vaultwarden('vaultwarden', { parent: this });
        }
    }
}
