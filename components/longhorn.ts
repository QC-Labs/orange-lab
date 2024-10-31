import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export interface LonghornArgs {
    version: string;
    replicaCount?: number;
}

export class Longhorn extends pulumi.ComponentResource {
    constructor(name: string, args: LonghornArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:storage:Longhorn', name, args, opts);

        new kubernetes.helm.v3.Release(
            `${name}-release`,
            {
                chart: 'longhorn',
                namespace: 'longhorn-system',
                createNamespace: true,
                version: args.version,
                repositoryOpts: {
                    repo: 'https://charts.longhorn.io',
                },
                values: {
                    defaultSettings: {
                        defaultReplicaCount: args.replicaCount,
                        storageOverProvisioningPercentage: 100,
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
