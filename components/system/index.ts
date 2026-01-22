import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '@orangelab/root-config';
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
            tailscaleDomain: rootConfig.tailnetDomain,
        };
    }

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system', name, args, opts);

        if (rootConfig.isEnabled('tailscale')) {
            new TailscaleOperator(
                'tailscale',
                {},
                {
                    parent: this,
                    aliases: [{ type: 'orangelab:system:TailscaleOperator' }],
                },
            );
        }

        if (rootConfig.isEnabled('traefik')) {
            new Traefik('traefik', {}, { parent: this });
        }

        let nfd: NodeFeatureDiscovery | undefined;
        if (rootConfig.isEnabled('nfd')) {
            nfd = new NodeFeatureDiscovery('nfd', { parent: this });
        }

        let certManager: CertManager | undefined;
        if (rootConfig.isEnabled('cert-manager')) {
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
            new AmdGPUOperator('amd-gpu-operator', {
                parent: this,
                dependsOn: [...(certManager ? [certManager] : []), ...(nfd ? [nfd] : [])],
            });
        }

        if (rootConfig.isEnabled('minio')) {
            this.minio = new Minio('minio', { parent: this });
        }

        if (rootConfig.isEnabled('longhorn')) {
            this.longhorn = new Longhorn(
                'longhorn',
                {
                    s3EndpointUrl: this.minio?.app.network.clusterEndpoints['minio-api'],
                    minioProvider: this.minio?.minioProvider,
                },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('debug')) {
            new Debug('debug', {}, { parent: this });
        }
    }
}
