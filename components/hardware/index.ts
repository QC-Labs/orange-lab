import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import { AmdGPUOperator } from './amd-gpu-operator/amd-gpu-operator';
import { NodeFeatureDiscovery } from './nfd/nfd';
import { NvidiaGPUOperator } from './nvidia-gpu-operator/nvidia-gpu-operator';

export class HardwareModule extends pulumi.ComponentResource {
    getExports() {
        return {};
    }

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:hardware', name, args, {
            ...opts,
            aliases: [{ type: 'orangelab:system' }],
        });

        const systemAlias = pulumi.interpolate`urn:pulumi:${pulumi.getStack()}::${pulumi.getProject()}::orangelab:system::system`;

        let nfd: NodeFeatureDiscovery | undefined;
        if (config.isEnabled('nfd')) {
            nfd = new NodeFeatureDiscovery('nfd', {
                parent: this,
                aliases: [{ type: 'orangelab:system:NFD', parent: systemAlias }],
            });
        }

        if (config.isEnabled('nvidia-gpu-operator')) {
            new NvidiaGPUOperator(
                'nvidia-gpu-operator',
                {},
                {
                    parent: this,
                    dependsOn: nfd,
                    aliases: [
                        {
                            type: 'orangelab:system:NvidiaGPUOperator',
                            parent: systemAlias,
                        },
                    ],
                },
            );
        }

        if (config.isEnabled('amd-gpu-operator')) {
            new AmdGPUOperator('amd-gpu-operator', {
                parent: this,
                dependsOn: nfd ? [nfd] : [],
                aliases: [
                    { type: 'orangelab:system:AmdGPUOperator', parent: systemAlias },
                ],
            });
        }
    }
}
