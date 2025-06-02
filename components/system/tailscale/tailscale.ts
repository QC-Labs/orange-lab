import * as pulumi from '@pulumi/pulumi';
import * as tailscale from '@pulumi/tailscale';

export class Tailscale extends pulumi.ComponentResource {
    public readonly serverKey: pulumi.Output<string> | undefined;
    public readonly agentKey: pulumi.Output<string> | undefined;
    public readonly tailnet: string;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Tailscale', name, args, opts);

        this.tailnet = new pulumi.Config(name).require('tailnet');

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
            { parent: this },
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
            { parent: this },
        );
        this.agentKey = agentKey.key;
    }
}
