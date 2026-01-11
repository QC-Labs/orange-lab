import * as pulumi from '@pulumi/pulumi';
import * as tailscale from '@pulumi/tailscale';

export class Tailscale extends pulumi.ComponentResource {
    public readonly serverKey: pulumi.Output<string> | undefined;
    public readonly agentKey: pulumi.Output<string> | undefined;
    public readonly oauthClientId: string;
    public readonly oauthClientSecret: pulumi.Output<string>;
    public readonly provider: tailscale.Provider;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Tailscale', name, args, opts);

        const config = new pulumi.Config(name);
        this.oauthClientId = config.require('oauthClientId');
        this.oauthClientSecret = config.requireSecret('oauthClientSecret');

        this.provider = new tailscale.Provider(
            `${name}-provider`,
            {
                oauthClientId: this.oauthClientId,
                oauthClientSecret: this.oauthClientSecret,
            },
            { parent: this, aliases: [{ name: 'default_0_23_0' }] },
        );

        const serverKey = new tailscale.TailnetKey(
            `${name}-server-key`,
            {
                reusable: true,
                preauthorized: true,
                description: 'Kubernetes server',
                tags: ['tag:orangelab'],
            },
            { parent: this, provider: this.provider },
        );
        this.serverKey = serverKey.key;

        const agentKey = new tailscale.TailnetKey(
            `${name}-agent-key`,
            {
                reusable: true,
                preauthorized: true,
                description: 'Kubernetes agents',
                tags: ['tag:orangelab'],
            },
            { parent: this, provider: this.provider },
        );
        this.agentKey = agentKey.key;
    }
}
