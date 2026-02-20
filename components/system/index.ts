import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import { CertManager } from './cert-manager/cert-manager';
import { Debug } from './debug/debug';
import { TailscaleOperator } from './tailscale/tailscale';
import { Traefik } from './traefik/traefik';

export class SystemModule extends pulumi.ComponentResource {

    getExports() {
        return {
            endpoints: {
            },
            tailscaleDomain: config.tailnetDomain,
        };
    }

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system', name, args, opts);

        if (config.isEnabled('tailscale')) {
            new TailscaleOperator(
                'tailscale',
                {},
                {
                    parent: this,
                    aliases: [{ type: 'orangelab:system:TailscaleOperator' }],
                },
            );
        }

        let certManager: CertManager | undefined;
        if (config.isEnabled('cert-manager')) {
            certManager = new CertManager('cert-manager', {}, { parent: this });
        }

        if (config.isEnabled('traefik')) {
            new Traefik('traefik', {}, { parent: this, dependsOn: certManager });
        }

        }

        if (config.isEnabled('debug')) {
            new Debug('debug', {}, { parent: this });
        }
    }
}
