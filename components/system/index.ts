import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { AmdGPU } from './amd-gpu';
import { Debug } from './debug';
import { Longhorn } from './longhorn';
import { Minio } from './minio';
import { NvidiaGPUOperator } from './nvidia-gpu-operator';
import { Tailscale } from './tailscale';
import { TailscaleOperator } from './tailscale-operator';

export class SystemModule extends pulumi.ComponentResource {
    tailscaleServerKey: pulumi.Output<string> | undefined;
    tailscaleAgentKey: pulumi.Output<string> | undefined;
    domainName: string;
    clusterCidr: string;
    serviceCidr: string;

    longhorn?: Longhorn;
    minio?: Minio;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system', name, args, opts);

        const tailscale = new Tailscale('tailscale', {}, { parent: this });
        this.tailscaleServerKey = tailscale.serverKey;
        this.tailscaleAgentKey = tailscale.agentKey;
        this.domainName = tailscale.tailnet;
        const enableMonitoring = rootConfig.enableMonitoring();

        if (rootConfig.isEnabled('tailscale-operator')) {
            new TailscaleOperator(
                'tailscale-operator',
                { namespace: 'tailscale', enableMonitoring },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('nvidia-gpu-operator')) {
            new NvidiaGPUOperator('nvidia-gpu-operator', {}, { parent: this });
        }

        if (rootConfig.isEnabled('amd-gpu')) {
            new AmdGPU('amd-gpu', {}, { parent: this });
        }

        if (rootConfig.isEnabled('minio')) {
            this.minio = new Minio(
                'minio',
                { domainName: this.domainName },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('longhorn')) {
            this.longhorn = new Longhorn(
                'longhorn',
                {
                    domainName: this.domainName,
                    enableMonitoring,
                    s3EndpointUrl: this.minio?.s3ClusterEndpoint,
                },
                { parent: this, dependsOn: [this.minio].filter(v => v !== undefined) },
            );
        }

        if (rootConfig.isEnabled('debug')) {
            new Debug('debug', {}, { parent: this });
        }

        const configK3s = new pulumi.Config('k3s');
        this.clusterCidr = configK3s.require('clusterCidr');
        this.serviceCidr = configK3s.require('serviceCidr');
    }
}
