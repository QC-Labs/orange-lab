import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class TailscaleOperator extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:network:TailscaleOperator', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');
        const hostname = config.require('hostname');
        const oauthClientId = config.requireSecret('oauthClientId');
        const oauthClientSecret = config.requireSecret('oauthClientSecret');

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'tailscale-operator',
                namespace: 'tailscale',
                createNamespace: true,
                version,
                repositoryOpts: {
                    repo: 'https://pkgs.tailscale.com/helmcharts',
                },
                values: {
                    oauth: {
                        clientId: oauthClientId,
                        clientSecret: oauthClientSecret,
                    },
                    apiServerProxyConfig: { mode: 'true' },
                    operatorConfig: { hostname },
                },
            },
            { parent: this },
        );
    }
}
