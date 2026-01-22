import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { rootConfig } from '@orangelab/root-config';

export class CertManager extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:CertManager', name, args, opts);

        const app = new Application(this, name);

        app.addHelmChart(name, {
            chart: 'cert-manager',
            repo: 'https://charts.jetstack.io',
            values: {
                affinity: app.nodes.getAffinity(),
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
