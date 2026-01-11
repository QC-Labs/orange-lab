import * as pulumi from '@pulumi/pulumi';
import * as tailscale from '@pulumi/tailscale';

export class Tailscale extends pulumi.ComponentResource {
    public readonly serverKey: pulumi.Output<string> | undefined;
    public readonly agentKey: pulumi.Output<string> | undefined;
    public readonly tailnet: string;
    public readonly oauthClientId: string;
    public readonly oauthClientSecret: pulumi.Output<string>;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Tailscale', name, args, opts);

        const config = new pulumi.Config(name);
        this.tailnet = config.require('tailnet');
        this.oauthClientId = config.require('oauthClientId');
        this.oauthClientSecret = config.requireSecret('oauthClientSecret');

        const provider = new tailscale.Provider(
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
                ephemeral: false,
                preauthorized: true,
                description: 'Kubernetes server',
                expiry: 7776000,
                recreateIfInvalid: 'always',
                tags: ['tag:k8s-server'],
            },
            { parent: this, provider },
        );
        this.serverKey = serverKey.key;

        const agentKey = new tailscale.TailnetKey(
            `${name}-agent-key`,
            {
                reusable: true,
                ephemeral: false,
                preauthorized: true,
                description: 'Kubernetes agents',
                expiry: 7776000,
                recreateIfInvalid: 'always',
                tags: ['tag:k8s-agent'],
            },
            { parent: this, provider },
        );
        this.agentKey = agentKey.key;
    }
}
