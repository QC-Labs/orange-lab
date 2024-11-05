import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class Longhorn extends pulumi.ComponentResource {
    private readonly version: string;
    private readonly replicaCount?: number;
    private readonly enableMonitoring: boolean;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:storage:Longhorn', name, args, opts);

        const config = new pulumi.Config('longhorn');
        this.version = config.require('version');
        this.replicaCount = config.getNumber('replicaCount');
        this.enableMonitoring = config.requireBoolean('enableMonitoring');

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
                    metrics: this.enableMonitoring
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
