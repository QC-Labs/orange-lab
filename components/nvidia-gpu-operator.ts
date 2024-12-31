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
        super('orangelab:system:NvidiaGPUOperator', name, args, opts);

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
                    // NVIDIA Confidential Computing Manager for Kubernetes
                    ccManager: {
                        enabled: false,
                    },
                    // NVidia Data Center GPU Manager - https://docs.nvidia.com/datacenter/dcgm/latest/user-guide/index.html
                    dcgm: {
                        enabled: false,
                    },
                    dcgmExporter: {
                        enabled: false,
                    },
                    // https://github.com/NVIDIA/k8s-device-plugin
                    devicePlugin: {
                        enabled: true,
                        config: {
                            create: true,
                            name: 'device-plugin-config',
                            default: 'default',
                            data: {
                                default: JSON.stringify({
                                    version: 'v1',
                                    flags: {
                                        migStrategy: 'none',
                                    },
                                    sharing: {
                                        timeSlicing: {
                                            resources: [
                                                {
                                                    name: 'nvidia.com/gpu',
                                                    replicas: 4,
                                                },
                                            ],
                                        },
                                    },
                                }),
                            },
                        },
                    },
                    // NVidia driver already installed on host
                    driver: {
                        enabled: false,
                        nodeSelector: {
                            'orangelab/gpu': 'true',
                        },
                    },
                    gdrcopy: {
                        enabled: false,
                    },
                    // GPUDirect Storage kernel driver - https://github.com/NVIDIA/gds-nvidia-fs
                    gds: {
                        enabled: false,
                    },
                    // GPU Feature Discovery
                    gfd: {
                        enabled: true,
                    },
                    kataManager: {
                        enabled: false,
                    },
                    migManager: {
                        enabled: false,
                    },
                    // Node Feature Discovery dependent chart
                    nfd: {
                        enabled: true,
                    },
                    // https://github.com/kubernetes-sigs/node-feature-discovery
                    'node-feature-discovery': {
                        worker: {
                            nodeSelector: {
                                'orangelab/gpu': 'true',
                            },
                            // set as priviledged to allow access to /etc/kubernetes/node-feature-discovery/features.d/
                            securityContext: {
                                allowPrivilegeEscalation: true,
                                privileged: true,
                            },
                        },
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
                    // NVidia container toolkit
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
                    // https://github.com/NVIDIA/vgpu-device-manager
                    vgpuDeviceManager: {
                        enabled: false,
                    },
                    vgpuManager: {
                        enabled: false,
                    },
                },
            },
            { parent: this, deleteBeforeReplace: true },
        );
    }
}
