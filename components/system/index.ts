import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import { AmdGPUOperator } from './amd-gpu-operator/amd-gpu-operator';
import { CertManager } from './cert-manager/cert-manager';
import { Debug } from './debug/debug';
import { Longhorn } from './longhorn/longhorn';
import { Minio } from './minio/minio';
import { NodeFeatureDiscovery } from './nfd/nfd';
import { NvidiaGPUOperator } from './nvidia-gpu-operator/nvidia-gpu-operator';
import { TailscaleOperator } from './tailscale/tailscale';
import { Traefik } from './traefik/traefik';

export class SystemModule extends pulumi.ComponentResource {
    longhorn?: Longhorn;
    minio?: Minio;

    getExports() {
        return {
            endpoints: {
                ...this.minio?.app.network.endpoints,
                longhorn: this.longhorn?.endpointUrl,
            },
            clusterEndpoints: {
                ...this.minio?.app.network.clusterEndpoints,
            },
            minioUsers: this.minio?.users,
            tailscaleDomain: config.tailnetDomain,
        };
    }

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system', name, args, opts);

        if (config.isEnabled('tailscale')) {
            new TailscaleOperator(
                'tailscale',
                {},
                {
                    parent: this,
                    aliases: [{ type: 'orangelab:system:TailscaleOperator' }],
                },
            );
        }

        if (config.isEnabled('traefik')) {
            new Traefik('traefik', {}, { parent: this });
        }

        let nfd: NodeFeatureDiscovery | undefined;
        if (config.isEnabled('nfd')) {
            nfd = new NodeFeatureDiscovery('nfd', { parent: this });
        }

        let certManager: CertManager | undefined;
        if (config.isEnabled('cert-manager')) {
            certManager = new CertManager('cert-manager', {}, { parent: this });
        }

        if (config.isEnabled('nvidia-gpu-operator')) {
            new NvidiaGPUOperator(
                'nvidia-gpu-operator',
                {},
                { parent: this, dependsOn: nfd },
            );
        }

        if (config.isEnabled('amd-gpu-operator')) {
            new AmdGPUOperator('amd-gpu-operator', {
                parent: this,
                dependsOn: [...(certManager ? [certManager] : []), ...(nfd ? [nfd] : [])],
            });
        }

        if (config.isEnabled('minio')) {
            this.minio = new Minio('minio', { parent: this });
        }

        if (config.isEnabled('longhorn')) {
            this.longhorn = new Longhorn(
                'longhorn',
                { s3Provisioner: this.minio?.s3Provisioner },
                { parent: this },
            );
        }

        if (config.isEnabled('debug')) {
            new Debug('debug', {}, { parent: this });
        }
    }
}
