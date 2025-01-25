import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { Prometheus } from './prometheus';

interface IoTModuleArgs {
    domainName: string;
}

export class MonitoringModule extends pulumi.ComponentResource {
    prometheus: Prometheus | undefined;

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
        }
    }
}
