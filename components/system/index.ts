import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { Longhorn } from './longhorn';
import { NvidiaGPUOperator } from './nvidia-gpu-operator';
import { Tailscale } from './tailscale';
import { TailscaleOperator } from './tailscale-operator';

export class SystemModule extends pulumi.ComponentResource {
    tailscaleServerKey: pulumi.Output<string> | undefined;
    tailscaleAgentKey: pulumi.Output<string> | undefined;
    domainName: string;

    longhorn: Longhorn | undefined;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system', name, args, opts);

        const tailscale = new Tailscale('tailscale', {}, { parent: this });
        this.tailscaleServerKey = tailscale.serverKey;
        this.tailscaleAgentKey = tailscale.agentKey;
        this.domainName = tailscale.tailnet;

        if (rootConfig.isEnabled('tailscale-operator')) {
            new TailscaleOperator(
                'tailscale-operator',
                { namespace: 'tailscale' },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('nvidia-gpu-operator')) {
            new NvidiaGPUOperator('nvidia-gpu-operator', {}, { parent: this });
        }

        if (rootConfig.isEnabled('longhorn')) {
            this.longhorn = new Longhorn(
                'longhorn',
                { domainName: this.domainName },
                { parent: this },
            );
        }
    }
}
