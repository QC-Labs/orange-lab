import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { GrafanaDashboard } from '../../grafana-dashboard';
import { rootConfig } from '../../root-config';
import dashboardGpuJson from './amd-dashboard_gpu.json';
import dashboardJobJson from './amd-dashboard_job.json';
import dashboardNodeJson from './amd-dashboard_node.json';
import dashboardOverviewJson from './amd-dashboard_overview.json';

export class AmdGPUOperator extends pulumi.ComponentResource {
    private readonly config: pulumi.Config;
    private readonly app: Application;

    constructor(private readonly name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:AmdGPUOperator', name, {}, opts);

        rootConfig.require(name, 'cert-manager');
        rootConfig.require(name, 'nfd');

        this.config = new pulumi.Config(name);
        this.app = new Application(this, name);

        const chart = this.createChart();
        this.createDeviceConfig(chart);

        if (rootConfig.enableMonitoring()) {
            this.createDashboards();
        }
    }

    private createChart(): kubernetes.helm.v3.Release {
        return new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'gpu-operator-charts',
                repositoryOpts: { repo: 'https://rocm.github.io/gpu-operator' },
                version: this.config.get('version'),
                namespace: this.app.namespace,
                values: {
                    kmm: { enabled: true },
                    installdefaultNFDRule: false,
                    crds: { defaultCR: { install: false } },
                    nodeSelector: { 'orangelab/gpu-amd': 'true' },
                    'node-feature-discovery': { enabled: false },
                },
            },
            { parent: this },
        );
    }

    private createDeviceConfig(chart: kubernetes.helm.v3.Release) {
        return new kubernetes.apiextensions.CustomResource(
            `${this.name}-config`,
            {
                apiVersion: 'amd.com/v1alpha1',
                kind: 'DeviceConfig',
                metadata: { name: this.name, namespace: this.app.namespace },
                spec: {
                    driver: { enable: false },
                    devicePlugin: { enableNodeLabeller: true },
                    metricsExporter: { enable: rootConfig.enableMonitoring() },
                    selector: { 'orangelab/gpu-amd': 'true' },
                    testRunner: { enable: false },
                },
            },
            { parent: this, dependsOn: chart },
        );
    }

    private createDashboards(): void {
        new GrafanaDashboard(`${this.name}-overview`, this, {
            configJson: dashboardOverviewJson,
            title: 'AMD - Overview',
        });
        new GrafanaDashboard(`${this.name}-gpu`, this, {
            configJson: dashboardGpuJson,
            title: 'AMD - GPU',
        });
        new GrafanaDashboard(`${this.name}-job`, this, {
            configJson: dashboardJobJson,
            title: 'AMD - Job',
        });
        new GrafanaDashboard(`${this.name}-node`, this, {
            configJson: dashboardNodeJson,
            title: 'AMD - Compute Node',
        });
    }
}
