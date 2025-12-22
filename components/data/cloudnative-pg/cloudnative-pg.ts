import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { GrafanaDashboard } from '../../grafana-dashboard';
import { rootConfig } from '../../root-config';
import grafanaDashboardJson from './grafana-dashboard.json';

export class CloudNativePG extends pulumi.ComponentResource {
    private readonly app: Application;

    constructor(
        private readonly name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:data:CloudNativePG', name, {}, opts);

        this.app = new Application(this, name, {
            namespace: 'cnpg-system',
        });

        this.createChart();
        if (rootConfig.enableMonitoring()) {
            new GrafanaDashboard(this.name, this, {
                configJson: grafanaDashboardJson,
                title: 'CloudNativePG',
            });
        }
    }

    private createChart(): kubernetes.helm.v3.Release {
        return this.app.addHelmChart(this.name, {
            chart: 'cloudnative-pg',
            repo: 'https://cloudnative-pg.github.io/charts/',
            values: {
                crds: { create: true },
                monitoring: {
                    podMonitorEnabled: rootConfig.enableMonitoring(),
                    grafanaDashboard: {
                        enabled: rootConfig.enableMonitoring(),
                    },
                },
                config: {
                    clusterWide: true,
                },
            },
        });
    }
}
