import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { GrafanaDashboard } from '../grafana-dashboard';
import dashboardOverviewJson from './amd-dashboard_overview.json';
import dashboardGpuJson from './amd-dashboard_gpu.json';
import dashboardJobJson from './amd-dashboard_job.json';
import dashboardNodeJson from './amd-dashboard_node.json';

interface AmdGPUOperatorArgs {
    enableMonitoring?: boolean;
}

export class AmdGPUOperator extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: AmdGPUOperatorArgs = {},
        opts?: pulumi.ResourceOptions,
    ) {
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

        if (args.enableMonitoring) {
            new GrafanaDashboard(`${name}-overview`, this, {
                configJson: dashboardOverviewJson,
                title: 'AMD - Overview',
            });
            new GrafanaDashboard(`${name}-gpu`, this, {
                configJson: dashboardGpuJson,
                title: 'AMD - GPU',
            });
            new GrafanaDashboard(`${name}-job`, this, {
                configJson: dashboardJobJson,
                title: 'AMD - Job',
            });
            new GrafanaDashboard(`${name}-node`, this, {
                configJson: dashboardNodeJson,
                title: 'AMD - Compute Node',
            });
        }
    }
}
