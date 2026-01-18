import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { rootConfig } from '../../root-config';

export class CertManager extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:CertManager', name, args, opts);

        const app = new Application(this, name);

        app.addHelmChart(name, {
            chart: 'cert-manager',
            repo: 'https://charts.jetstack.io',
            values: {
                crds: {
                    enabled: true,
                    keep: true,
                },
                prometheus: rootConfig.enableMonitoring()
                    ? {
                          servicemonitor: {
                              enabled: true,
                          },
                      }
                    : undefined,
            },
        });
    }
}
