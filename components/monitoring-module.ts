import * as pulumi from '@pulumi/pulumi';
import { Prometheus } from './monitoring/prometheus';
import { rootConfig } from './root-config';

interface IoTModuleArgs {
    domainName: string;
}

export class MonitoringModule extends pulumi.ComponentResource {
    grafanaUrl: string | undefined;

    private prometheus: Prometheus | undefined;

    constructor(
        name: string,
        args: IoTModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:monitoring', name, args, opts);

        if (rootConfig.isEnabled('prometheus')) {
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
}
