import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

// Homepage: https://github.com/NVIDIA/k8s-device-plugin
export class NVidiaDevicePlugin extends pulumi.ComponentResource {
    public readonly serverKey: pulumi.Output<string> | undefined;
    public readonly agentKey: pulumi.Output<string> | undefined;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:NVidiaDevicePlugin', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'nvidia-device-plugin',
                namespace: 'nvidia-device-plugin',
                createNamespace: true,
                version,
                repositoryOpts: {
                    repo: 'https://nvidia.github.io/k8s-device-plugin',
                },
                values: {
                    nodeSelector: {
                        'orangelab/gpu': 'true',
                    },
                    runtimeClassName: 'nvidia',
                    gfd: {
                        enabled: true,
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
