import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { rootConfig } from '../../root-config';

export class CloudNativePG extends pulumi.ComponentResource {
    private readonly config: pulumi.Config;
    private readonly app: Application;
    private readonly version?: string;

    constructor(private readonly name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:CloudNativePG', name, {}, opts);

        this.config = new pulumi.Config(name);
        this.app = new Application(this, name, {
            namespace: 'cnpg-system',
        });
        this.version = this.config.get('version');

        this.createChart();
    }

    private createChart(): kubernetes.helm.v3.Release {
        return new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'cloudnative-pg',
                repositoryOpts: {
                    repo: 'https://cloudnative-pg.github.io/charts/',
                },
                version: this.version,
                namespace: this.app.namespace,
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
            },
            { parent: this },
        );
    }
}
