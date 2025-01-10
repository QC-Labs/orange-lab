import * as pulumi from '@pulumi/pulumi';
import { Prometheus } from './monitoring/prometheus';

interface IoTModuleArgs {
    domainName: string;
}

export class MonitoringModule extends pulumi.ComponentResource {
    grafanaUrl: string | undefined;

    private prometheus: Prometheus | undefined;

    private config = new pulumi.Config('orangelab');

    constructor(
        name: string,
        args: IoTModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:monitoring', name, args, opts);

        if (this.isModuleEnabled('prometheus')) {
            this.prometheus = new Prometheus(
                'prometheus',
                {
                    domainName: args.domainName,
                },
                { parent: this },
            );
            this.grafanaUrl = this.prometheus.grafanaEndpointUrl;
        }
    }

    public isModuleEnabled(name: string): boolean {
        return this.config.requireBoolean(name);
    }
}
