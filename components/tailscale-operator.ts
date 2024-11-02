import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class TailscaleOperator extends pulumi.ComponentResource {
    public readonly serverKey: pulumi.Output<string> | undefined;
    public readonly agentKey: pulumi.Output<string> | undefined;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:network:TailscaleOperator', name, args, opts);

        const config = new pulumi.Config(name);

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'tailscale-operator',
                namespace: 'tailscale',
                createNamespace: true,
                version: config.require('version'),
                repositoryOpts: {
                    repo: 'https://pkgs.tailscale.com/helmcharts',
                },
                values: {
                    oauth: {
                        clientId: config.requireSecret('oauthClientId'),
                        clientSecret: config.requireSecret('oauthClientSecret'),
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
