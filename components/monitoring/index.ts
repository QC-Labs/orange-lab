import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { Beszel } from './beszel/beszel';
import { Prometheus } from './prometheus/prometheus';

export class MonitoringModule extends pulumi.ComponentResource {
    prometheus: Prometheus | undefined;
    beszel: Beszel | undefined;

    getExports() {
        return {
            endpoints: {
                alertmanager: this.prometheus?.alertmanagerEndpointUrl,
                ...this.beszel?.app.network.endpoints,
                grafana: this.prometheus?.grafanaEndpointUrl,
                prometheus: this.prometheus?.prometheusEndpointUrl,
            },
        };
    }

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super('orangelab:monitoring', name, {}, opts);

        if (rootConfig.isEnabled('prometheus')) {
            this.prometheus = new Prometheus('prometheus', { parent: this });
        }

        if (rootConfig.isEnabled('beszel')) {
            this.beszel = new Beszel('beszel', { parent: this });
        }
    }
}
