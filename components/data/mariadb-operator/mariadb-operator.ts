import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class MariaDBOperator extends pulumi.ComponentResource {
    private readonly app: Application;
    private readonly crdsChart: kubernetes.helm.v3.Release;

    constructor(
        private readonly name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:data:MariaDBOperator', name, {}, opts);

        this.app = new Application(this, name);

        this.crdsChart = this.createCRDs();
        this.createChart();
    }

    private createCRDs(): kubernetes.helm.v3.Release {
        return this.app.addHelmChart(
            `${this.name}-crds`,
            {
                chart: 'mariadb-operator-crds',
                repo: 'https://mariadb-operator.github.io/mariadb-operator',
            },
            {
                dependsOn: [this.app.storage].filter(Boolean) as pulumi.Resource[],
            },
        );
    }

    private createChart(): kubernetes.helm.v3.Release {
        const debug = config.getBoolean(this.name, 'debug');
        const monitoring = config.enableMonitoring();
        return this.app.addHelmChart(
            this.name,
            {
                chart: 'mariadb-operator',
                repo: 'https://mariadb-operator.github.io/mariadb-operator',
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    crds: { enabled: false },
                    logLevel: debug ? 'DEBUG' : 'INFO',
                    metrics: {
                        enabled: monitoring,
                        serviceMonitor: {
                            enabled: monitoring,
                        },
                    },
                    webhook: {
                        certManager: {
                            enabled: true,
                        },
                    },
                },
            },
            { dependsOn: [this.crdsChart] },
        );
    }
}
