import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { GrafanaDashboard } from '@orangelab/grafana-dashboard';
import { config } from '@orangelab/config';
import dashboardGpuJson from './amd-dashboard_gpu.json';
import dashboardJobJson from './amd-dashboard_job.json';
import dashboardNodeJson from './amd-dashboard_node.json';
import dashboardOverviewJson from './amd-dashboard_overview.json';

export class AmdGPUOperator extends pulumi.ComponentResource {
    private readonly app: Application;

    constructor(
        private readonly name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:AmdGPUOperator', name, {}, opts);

        config.requireEnabled(name, 'cert-manager');
        if (config.getBoolean('nfd', 'gpu-autodetect')) {
            config.requireEnabled(name, 'nfd');
        }

        this.app = new Application(this, name);

        const chart = this.createChart();
        this.createDeviceConfig(chart);

        if (config.enableMonitoring()) {
            this.createDashboards();
        }
    }

    private createChart(): kubernetes.helm.v3.Release {
        return this.app.addHelmChart(this.name, {
            chart: 'gpu-operator-charts',
            repo: 'https://rocm.github.io/gpu-operator',
            values: {
                kmm: { enabled: true },
                installdefaultNFDRule: false,
                crds: { defaultCR: { install: false } },
                nodeSelector: { 'orangelab/gpu-amd': 'true' },
                'node-feature-discovery': { enabled: false },
            },
        });
    }

    private createDeviceConfig(chart: kubernetes.helm.v3.Release) {
        return new kubernetes.apiextensions.CustomResource(
            `${this.name}-config`,
            {
                apiVersion: 'amd.com/v1alpha1',
                kind: 'DeviceConfig',
                metadata: { name: this.name, namespace: this.app.metadata.namespace },
                spec: {
                    driver: { enable: false },
                    devicePlugin: { enableNodeLabeller: true },
                    metricsExporter: { enable: config.enableMonitoring() },
                    selector: { 'orangelab/gpu-amd': 'true' },
                    testRunner: { enable: false },
                },
            },
            { parent: this, dependsOn: chart },
        );
    }

    private createDashboards(): void {
        new GrafanaDashboard(
            `${this.name}-overview`,
            {
                configJson: dashboardOverviewJson,
                title: 'AMD - Overview',
            },
            { parent: this },
        );
        new GrafanaDashboard(
            `${this.name}-gpu`,
            {
                configJson: dashboardGpuJson,
                title: 'AMD - GPU',
            },
            { parent: this },
        );
        new GrafanaDashboard(
            `${this.name}-job`,
            {
                configJson: dashboardJobJson,
                title: 'AMD - Job',
            },
            { parent: this },
        );
        new GrafanaDashboard(
            `${this.name}-node`,
            {
                configJson: dashboardNodeJson,
                title: 'AMD - Compute Node',
            },
            { parent: this },
        );
    }
}
