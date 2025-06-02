import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { AmdGPUOperator } from './amd-gpu-operator/amd-gpu-operator';
import { CertManager } from './cert-manager';
import { Debug } from './debug';
import { Longhorn } from './longhorn/longhorn';
import { Minio } from './minio/minio';
import { NodeFeatureDiscovery } from './nfd';
import { NvidiaGPUOperator } from './nvidia-gpu-operator';
import { Tailscale } from './tailscale/tailscale';
import { TailscaleOperator } from './tailscale/tailscale-operator';

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

        let nfd: NodeFeatureDiscovery | undefined;
        if (
            rootConfig.isEnabled('nfd') ||
            rootConfig.isEnabled('nvidia-gpu-operator') ||
            rootConfig.isEnabled('amd-gpu-operator')
        ) {
            nfd = new NodeFeatureDiscovery('nfd', { enableMonitoring }, { parent: this });
        }

        let certManager: CertManager | undefined;
        if (
            rootConfig.isEnabled('cert-manager') ||
            rootConfig.isEnabled('amd-gpu-operator')
        ) {
            certManager = new CertManager('cert-manager', {}, { parent: this });
        }

        if (rootConfig.isEnabled('nvidia-gpu-operator')) {
            new NvidiaGPUOperator(
                'nvidia-gpu-operator',
                {},
                { parent: this, dependsOn: nfd },
            );
        }

        if (rootConfig.isEnabled('amd-gpu-operator')) {
            new AmdGPUOperator(
                'amd-gpu-operator',
                { enableMonitoring },
                {
                    parent: this,
                    dependsOn: [
                        ...(certManager ? [certManager] : []),
                        ...(nfd ? [nfd] : []),
                    ],
                },
            );
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
                    s3EndpointUrl: this.minio?.s3ApiClusterUrl,
                    minioProvider: this.minio?.minioProvider,
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
