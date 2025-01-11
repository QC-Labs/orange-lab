import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from './root-config';
import { Longhorn } from './system/longhorn';
import { NvidiaGPUOperator } from './system/nvidia-gpu-operator';
import { Tailscale } from './system/tailscale';
import { TailscaleOperator } from './system/tailscale-operator';

export class SystemModule extends pulumi.ComponentResource {
    tailscaleServerKey: pulumi.Output<string> | undefined;
    tailscaleAgentKey: pulumi.Output<string> | undefined;
    domainName: string;
    longhornUrl: string | undefined;
    defaultStorageClass = ''; // local-path-provisioner
    gpuStorageClass = '';

    private longhorn: Longhorn | undefined;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system', name, args, opts);

        const tailscale = new Tailscale('tailscale', {}, { parent: this });
        this.tailscaleServerKey = tailscale.serverKey;
        this.tailscaleAgentKey = tailscale.agentKey;
        this.domainName = tailscale.tailnet;

        if (rootConfig.isEnabled('tailscale-operator')) {
            new TailscaleOperator('tailscale-operator', {}, { parent: this });
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
            this.longhornUrl = this.longhorn.endpointUrl;
            this.defaultStorageClass = this.longhorn.defaultStorageClass;
            this.gpuStorageClass = this.longhorn.gpuStorageClass;
        }
    }
}
