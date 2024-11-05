import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

interface LonghornArgs {
    enableMonitoring?: boolean;
}

export class Longhorn extends pulumi.ComponentResource {
    private readonly version: string;
    private readonly replicaCount?: number;

    constructor(name: string, args: LonghornArgs = {}, opts?: pulumi.ResourceOptions) {
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
                    metrics: args.enableMonitoring
                        ? {
                              serviceMonitor: {
                                  enabled: true,
                              },
                          }
                        : undefined,
                    ingress: {
                        enabled: true,
                        ingressClassName: 'tailscale',
                        host: 'longhorn',
                        tls: {
                            hosts: ['longhorn'],
                        },
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
