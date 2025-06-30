import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { rootConfig } from '../../root-config';

export class MariaDBOperator extends pulumi.ComponentResource {
    private readonly config: pulumi.Config;
    private readonly app: Application;
    private readonly crdsChart: kubernetes.helm.v3.Release;
    private readonly version?: string;

    constructor(private readonly name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:MariaDBOperator', name, {}, opts);

        this.config = new pulumi.Config(name);
        this.app = new Application(this, name);
        this.version = this.config.get('version');

        this.crdsChart = this.createCRDs();
        this.createChart();
    }

    private createCRDs(): kubernetes.helm.v3.Release {
        return new kubernetes.helm.v3.Release(
            `${this.name}-crds`,
            {
                chart: 'mariadb-operator-crds',
                repositoryOpts: {
                    repo: 'https://mariadb-operator.github.io/mariadb-operator',
                },
                version: this.version,
                namespace: this.app.namespace,
            },
            { parent: this, dependsOn: [this.app.storage] },
        );
    }

    private createChart(): kubernetes.helm.v3.Release {
        const debug = this.config.getBoolean('debug');
        const monitoring = rootConfig.enableMonitoring();
        return new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'mariadb-operator',
                repositoryOpts: {
                    repo: 'https://mariadb-operator.github.io/mariadb-operator',
                },
                version: this.version,
                namespace: this.app.namespace,
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
            { parent: this, dependsOn: [this.crdsChart] },
        );
    }
}
