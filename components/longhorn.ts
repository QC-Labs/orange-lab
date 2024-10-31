import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class Longhorn extends pulumi.ComponentResource {
    private readonly version: string;
    private readonly replicaCount?: number;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:storage:Longhorn', name, args, opts);

        const config = new pulumi.Config('longhorn');
        this.version = config.require('version');
        this.replicaCount = config.getNumber('replicaCount');

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'longhorn',
                namespace: 'longhorn-system',
                createNamespace: true,
                version: this.version,
                repositoryOpts: {
                    repo: 'https://charts.longhorn.io',
                },
                values: {
                    defaultSettings: {
                        defaultReplicaCount: this.replicaCount,
                        storageOverProvisioningPercentage: 100,
                    },
                    metrics: {
                        serviceMonitor: {
                            enabled: true,
                        },
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
