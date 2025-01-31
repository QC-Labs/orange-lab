import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { Prometheus } from './prometheus';
import { Beszel } from './beszel';

interface IoTModuleArgs {
    domainName: string;
}

export class MonitoringModule extends pulumi.ComponentResource {
    prometheus: Prometheus | undefined;
    beszel: Beszel | undefined;

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

        if (rootConfig.isEnabled('beszel')) {
            this.beszel = new Beszel(
                'beszel',
                {
                    domainName: args.domainName,
                },
                { parent: this },
            );
        }
    }
}
