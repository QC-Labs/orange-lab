import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

// Homepage: https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/
export class NvidiaGPUOperator extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:NvidiaGPUOperator', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'gpu-operator',
                namespace: 'nvidia-gpu-operator',
                createNamespace: true,
                version,
                repositoryOpts: {
                    repo: 'https://helm.ngc.nvidia.com/nvidia',
                },
                values: {
                    dcgmExporter: {
                        enabled: false,
                    },
                    driver: {
                        enabled: false,
                    },
                    migManager: {
                        enabled: false,
                    },
                    toolkit: {
                        enabled: true,
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
