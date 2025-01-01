import * as pulumi from '@pulumi/pulumi';
import { Prometheus } from './monitoring/prometheus';
import { Tailscale } from './network/tailscale';
import { TailscaleOperator } from './network/tailscale-operator';
import { NvidiaGPUOperator } from './nvidia-gpu-operator';
import { Longhorn } from './storage/longhorn';

export class SystemModule extends pulumi.ComponentResource {
    tailscaleServerKey: pulumi.Output<string> | undefined;
    tailscaleAgentKey: pulumi.Output<string> | undefined;
    domainName: string;
    longhornUrl: string | undefined;
    defaultStorageClass = '';
    gpuStorageClass = '';
    grafanaUrl: string | undefined;

    private config = new pulumi.Config('orangelab');
    private longhorn: Longhorn | undefined;
    private prometheus: Prometheus | undefined;

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
            this.defaultStorageClass = 'longhorn';
            this.gpuStorageClass = 'gpu-storage';
        }

        if (this.isModuleEnabled('prometheus')) {
            this.prometheus = new Prometheus(
                'prometheus',
                { domainName: this.domainName },
                { dependsOn: this.longhorn },
            );
            this.grafanaUrl = this.prometheus.grafanaEndpointUrl;
        }
    }

    public isModuleEnabled(name: string): boolean {
        return this.config.requireBoolean(name);
    }
}
