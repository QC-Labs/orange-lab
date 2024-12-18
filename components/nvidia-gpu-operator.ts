import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

/**
 * Homepage: https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/
 *
 * Default values: https://github.com/NVIDIA/gpu-operator/blob/main/deployments/gpu-operator/values.yaml
 *
 * Components: https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/platform-support.html#gpu-operator-component-matrix
 */
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
                    ccManager: {
                        enabled: false,
                    },
                    dcgm: {
                        enabled: false,
                    },
                    dcgmExporter: {
                        enabled: false,
                    },
                    devicePlugin: {
                        enabled: true,
                    },
                    driver: {
                        enabled: false,
                    },
                    gdrcopy: {
                        enabled: false,
                    },
                    gds: {
                        enabled: false,
                    },
                    gfd: {
                        enabled: true,
                    },
                    kataManager: {
                        enabled: false,
                    },
                    migManager: {
                        enabled: false,
                    },
                    nodeStatusExporter: {
                        enabled: false,
                    },
                    operator: {
                        defaultRuntime: 'containerd',
                    },
                    sandboxDevicePlugin: {
                        enabled: false,
                    },
                    toolkit: {
                        enabled: true,
                        env: [
                            {
                                name: 'CONTAINERD_CONFIG',
                                value: '/var/lib/rancher/k3s/agent/etc/containerd/config.toml',
                            },
                            {
                                name: 'CONTAINERD_SOCKET',
                                value: '/run/k3s/containerd/containerd.sock',
                            },
                            {
                                name: 'CONTAINERD_RUNTIME_CLASS',
                                value: 'nvidia',
                            },
                            {
                                name: 'CONTAINERD_SET_AS_DEFAULT',
                                value: 'true',
                            },
                        ],
                    },
                    vfioManager: {
                        enabled: false,
                    },
                    vgpuDeviceManager: {
                        enabled: false,
                    },
                    vgpuManager: {
                        enabled: false,
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
