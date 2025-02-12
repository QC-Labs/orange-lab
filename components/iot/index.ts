import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { HomeAssistant } from './home-assistant';

interface IoTModuleArgs {
    domainName: string;
    clusterCidr: string;
    serviceCidr: string;
}

export class IoTModule extends pulumi.ComponentResource {
    homeAssistant: HomeAssistant | undefined;

    constructor(
        name: string,
        args: IoTModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:iot', name, args, opts);

        if (rootConfig.isEnabled('home-assistant')) {
            this.homeAssistant = new HomeAssistant(
                'home-assistant',
                {
                    domainName: args.domainName,
                    trustedProxies: [args.clusterCidr, args.serviceCidr, '127.0.0.0/8'],
                },
                { parent: this },
            );
        }
    }
}
