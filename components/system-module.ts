import * as pulumi from '@pulumi/pulumi';
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

    private config = new pulumi.Config('orangelab');
    private longhorn: Longhorn | undefined;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system', name, args, opts);

        const tailscale = new Tailscale('tailscale');
        this.tailscaleServerKey = tailscale.serverKey;
        this.tailscaleAgentKey = tailscale.agentKey;
        this.domainName = tailscale.tailnet;

        if (this.isModuleEnabled('tailscale-operator')) {
            new TailscaleOperator('tailscale-operator');
        }

        if (this.isModuleEnabled('nvidia-gpu-operator')) {
            new NvidiaGPUOperator('nvidia-gpu-operator');
        }

        if (this.isModuleEnabled('longhorn')) {
            this.longhorn = new Longhorn('longhorn', { domainName: this.domainName });
            this.longhornUrl = this.longhorn.endpointUrl;
            this.defaultStorageClass = this.longhorn.defaultStorageClass;
            this.gpuStorageClass = this.longhorn.gpuStorageClass;
        }
    }

    public isModuleEnabled(name: string): boolean {
        return this.config.requireBoolean(name);
    }
}
