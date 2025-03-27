import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export class AmdGPUOperator extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:AmdGPUOperator', name, args, opts);

        const config = new pulumi.Config(name);
        const app = new Application(this, name);

        const chart = new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'gpu-operator-charts',
                repositoryOpts: { repo: 'https://rocm.github.io/gpu-operator' },
                version: config.get('version'),
                namespace: app.namespace,
                values: {
                    nodeSelector: { 'orangelab/gpu': 'amd' },
                    'node-feature-discovery': { enabled: true },
                    kmm: { enabled: true },
                },
            },
            { parent: this },
        );

        new kubernetes.apiextensions.CustomResource(
            `${name}-config`,
            {
                apiVersion: 'amd.com/v1alpha1',
                kind: 'DeviceConfig',
                metadata: { name, namespace: app.namespace },
                spec: {
                    driver: { enable: false },
                    devicePlugin: { enableNodeLabeller: true },
                    metricsExporter: { enable: true },
                    selector: {
                        'orangelab/gpu': 'amd',
                    },
                    testRunner: { enable: false },
                },
            },
            { parent: this, dependsOn: chart },
        );
    }
}
