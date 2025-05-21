import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

interface NodeFeatureDiscoveryArgs {
    enableMonitoring?: boolean;
}

export class NodeFeatureDiscovery extends pulumi.ComponentResource {
    private readonly config: pulumi.Config;
    private readonly app: Application;

    constructor(
        private readonly name: string,
        private readonly args: NodeFeatureDiscoveryArgs = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:NFD', name, args, opts);

        this.config = new pulumi.Config(name);
        this.app = new Application(this, name);

        this.createHelmChart();

        if (this.config.getBoolean('gpu-autodetect')) {
            this.createAmdGpuRule();
            this.createNvidiaGpuRule();
        }
    }

    private createHelmChart(): kubernetes.helm.v3.Release {
        return new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'node-feature-discovery',
                repositoryOpts: {
                    repo: 'https://kubernetes-sigs.github.io/node-feature-discovery/charts',
                },
                version: this.config.get('version'),
                namespace: this.app.namespace,
                values: {
                    prometheus: { enable: this.args.enableMonitoring },
                    worker: {
                        // set as priviledged to allow access to /etc/kubernetes/node-feature-discovery/features.d/
                        securityContext: {
                            allowPrivilegeEscalation: true,
                            privileged: true,
                        },
                    },
                },
            },
            { parent: this },
        );
    }

    // Based on https://github.com/ROCm/gpu-operator/blob/main/helm-charts/templates/nfd-default-rule.yaml
    private createAmdGpuRule(): kubernetes.apiextensions.CustomResource {
        const vendorId = ['1002']; // AMD vendor ID
        const gpuClass = ['0300']; // Display/GPU class
        return new kubernetes.apiextensions.CustomResource(
            `${this.name}-rule-amd`,
            {
                apiVersion: 'nfd.k8s-sigs.io/v1alpha1',
                kind: 'NodeFeatureRule',
                metadata: { name: 'amd-gpu-label-nfd-rule' },
                spec: {
                    rules: [
                        {
                            name: 'amd-gpu',
                            annotations: {
                                'node.longhorn.io/default-node-tags':
                                    '["gpu", "gpu-amd"]',
                            },
                            labels: {
                                'orangelab/gpu': 'true',
                                'orangelab/gpu-amd': 'true',
                            },
                            matchAny: [
                                {
                                    matchFeatures: [
                                        {
                                            feature: 'pci.device',
                                            matchExpressions: {
                                                vendor: { op: 'In', value: vendorId },
                                                class: { op: 'In', value: gpuClass },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
            { parent: this },
        );
    }

    private createNvidiaGpuRule(): kubernetes.apiextensions.CustomResource {
        const vendorId = ['10de']; // NVIDIA vendor ID
        const gpuClass = ['0300', '0302']; // Display/GPU classes
        return new kubernetes.apiextensions.CustomResource(
            `${this.name}-rule-nvidia`,
            {
                apiVersion: 'nfd.k8s-sigs.io/v1alpha1',
                kind: 'NodeFeatureRule',
                metadata: { name: 'nvidia-gpu-label-nfd-rule' },
                spec: {
                    rules: [
                        {
                            name: 'nvidia-gpu',
                            annotations: {
                                'node.longhorn.io/default-node-tags':
                                    '["gpu","gpu-nvidia"]',
                            },
                            labels: {
                                'orangelab/gpu': 'true',
                                'orangelab/gpu-nvidia': 'true',
                            },
                            matchAny: [
                                {
                                    matchFeatures: [
                                        {
                                            feature: 'pci.device',
                                            matchExpressions: {
                                                vendor: { op: 'In', value: vendorId },
                                                class: { op: 'In', value: gpuClass },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
            { parent: this },
        );
    }
}
