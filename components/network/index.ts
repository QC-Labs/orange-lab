import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import { CertManager } from './cert-manager/cert-manager';
import { TailscaleOperator } from './tailscale/tailscale';
import { Technitium } from './technitium/technitium';
import { Traefik } from './traefik/traefik';

export class NetworkModule extends pulumi.ComponentResource {
    technitium?: Technitium;

    getExports() {
        return {
            endpoints: {
                technitium: this.technitium?.endpointUrl,
            },
            technitiumUsers: this.technitium?.users,
            tailscaleDomain: config.tailnetDomain,
        };
    }

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:network', name, args, {
            ...opts,
            aliases: [{ type: 'orangelab:system' }],
        });

        const systemAlias = pulumi.interpolate`urn:pulumi:${pulumi.getStack()}::${pulumi.getProject()}::orangelab:system::system`;

        if (config.isEnabled('tailscale')) {
            new TailscaleOperator(
                'tailscale',
                {},
                {
                    parent: this,
                    aliases: [
                        { type: 'orangelab:system:Tailscale', parent: systemAlias },
                    ],
                },
            );
        }

        let certManager: CertManager | undefined;
        if (config.isEnabled('cert-manager')) {
            certManager = new CertManager(
                'cert-manager',
                {},
                {
                    parent: this,
                    aliases: [
                        { type: 'orangelab:system:CertManager', parent: systemAlias },
                    ],
                },
            );
        }

        if (config.isEnabled('traefik')) {
            new Traefik(
                'traefik',
                {},
                {
                    parent: this,
                    dependsOn: certManager,
                    aliases: [{ type: 'orangelab:system:Traefik', parent: systemAlias }],
                },
            );
        }

        if (config.isEnabled('technitium')) {
            this.technitium = new Technitium(
                'technitium',
                {},
                {
                    parent: this,
                    aliases: [
                        { type: 'orangelab:system:Technitium', parent: systemAlias },
                    ],
                },
            );
        }
    }
}
