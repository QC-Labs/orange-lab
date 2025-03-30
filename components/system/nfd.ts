import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

interface NodeFeatureDiscoveryArgs {
    enableMonitoring?: boolean;
}

export class NodeFeatureDiscovery extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: NodeFeatureDiscoveryArgs = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:NFD', name, args, opts);

        const config = new pulumi.Config(name);
        const app = new Application(this, name);

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'node-feature-discovery',
                repositoryOpts: {
                    repo: 'https://kubernetes-sigs.github.io/node-feature-discovery/charts',
                },
                version: config.get('version'),
                namespace: app.namespace,
                values: {
                    prometheus: { enable: args.enableMonitoring },
                    worker: {
                        // set as priviledged to allow access to /etc/kubernetes/node-feature-discovery/features.d/
                        securityContext: {
                            allowPrivilegeEscalation: true,
                            privileged: true,
                        },
                    },
                },
            },
            { parent: this },
        );
    }
}
