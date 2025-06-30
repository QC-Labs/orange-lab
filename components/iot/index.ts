import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { HomeAssistant } from './home-assistant';

interface IoTModuleArgs {
    clusterCidr: string;
    serviceCidr: string;
}

export class IoTModule extends pulumi.ComponentResource {
    private readonly homeAssistant: HomeAssistant | undefined;

    getExports() {
        return {
            endpoints: {
                homeAssistant: this.homeAssistant?.endpointUrl,
            },
        };
    }

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
                    trustedProxies: [args.clusterCidr, args.serviceCidr, '127.0.0.0/8'],
                },
                { parent: this },
            );
        }
    }
}
