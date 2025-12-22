import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { rootConfig } from '../root-config';

export class NvidiaGPUOperator extends pulumi.ComponentResource {
    private readonly app: Application;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:NvidiaGPUOperator', name, args, opts);

        rootConfig.require(name, 'nfd');

        this.app = new Application(this, name);

        this.app.addHelmChart(
            name,
            {
                chart: 'gpu-operator',
                repo: 'https://helm.ngc.nvidia.com/nvidia',
                values: {
                    // NVIDIA Confidential Computing Manager for Kubernetes
                    ccManager: { enabled: false },
                    // NVidia Data Center GPU Manager - https://docs.nvidia.com/datacenter/dcgm/latest/user-guide/index.html
                    dcgm: { enabled: false },
                    dcgmExporter: { enabled: false },
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
                        nodeSelector: { 'orangelab/gpu-nvidia': 'true' },
                    },
                    gdrcopy: { enabled: false },
                    // GPUDirect Storage kernel driver - https://github.com/NVIDIA/gds-nvidia-fs
                    gds: { enabled: false },
                    // GPU Feature Discovery
                    gfd: { enabled: true },
                    kataManager: { enabled: false },
                    migManager: { enabled: false },
                    // Node Feature Discovery dependent chart
                    nfd: { enabled: false },
                    nodeStatusExporter: { enabled: false },
                    operator: { defaultRuntime: 'containerd' },
                    sandboxDevicePlugin: { enabled: false },
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
                    vfioManager: { enabled: false },
                    // https://github.com/NVIDIA/vgpu-device-manager
                    vgpuDeviceManager: { enabled: false },
                    vgpuManager: { enabled: false },
                },
            },
            { deleteBeforeReplace: true },
        );
    }
}
