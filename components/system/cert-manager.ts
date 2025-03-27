import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export class CertManager extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:CertManager', name, args, opts);

        const config = new pulumi.Config(name);
        const app = new Application(this, name);

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'cert-manager',
                repositoryOpts: { repo: 'https://charts.jetstack.io' },
                version: config.get('version'),
                namespace: app.namespace,
                values: {
                    crds: {
                        enabled: true,
                    },
                },
            },
            { parent: this },
        );
    }
}
