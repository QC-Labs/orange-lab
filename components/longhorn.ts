import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class Longhorn extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:storage:Longhorn', name, args, opts);

        const config = new pulumi.Config('longhorn');
        const version = config.require('version');
        const hostname = config.require('hostname');
        const replicaCount = config.getNumber('replicaCount');
        const enableMonitoring = config.requireBoolean('enableMonitoring');

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'longhorn',
                namespace: 'longhorn-system',
                createNamespace: true,
                version,
                repositoryOpts: { repo: 'https://charts.longhorn.io' },
                values: {
                    defaultSettings: {
                        defaultReplicaCount: replicaCount,
                        storageOverProvisioningPercentage: 100,
                    },
                    metrics: enableMonitoring
                        ? { serviceMonitor: { enabled: true } }
                        : undefined,
                    ingress: {
                        enabled: true,
                        ingressClassName: 'tailscale',
                        host: hostname,
                        tls: { hosts: [hostname] },
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
