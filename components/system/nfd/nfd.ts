import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';

export class NodeFeatureDiscovery extends pulumi.ComponentResource {
    private readonly app: Application;
    chart: kubernetes.helm.v3.Release;

    constructor(
        private readonly name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:NFD', name, {}, opts);

        this.app = new Application(this, name);

        this.chart = this.createHelmChart();

        if (config.getBoolean(name, 'gpu-autodetect')) {
            this.createAmdGpuRule();
            this.createNvidiaGpuRule();
        }
    }

    private createHelmChart(): kubernetes.helm.v3.Release {
        return this.app.addHelmChart(this.name, {
            chart: 'node-feature-discovery',
            repo: 'https://kubernetes-sigs.github.io/node-feature-discovery/charts',
            values: {
                prometheus: { enable: config.enableMonitoring() },
                master: {
                    denyLabelNs: [],
                    extraLabelNs: ['node-role.kubernetes.io'],
                },
                worker: {
                    // set as priviledged to allow access to /etc/kubernetes/node-feature-discovery/features.d/
                    securityContext: {
                        allowPrivilegeEscalation: true,
                        privileged: true,
                    },
                },
            },
        });
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
                                'node-role.kubernetes.io/gpu': 'true',
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
            { parent: this, dependsOn: [this.chart] },
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
                                'node-role.kubernetes.io/gpu': 'true',
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
            { parent: this, dependsOn: [this.chart] },
        );
    }
}
