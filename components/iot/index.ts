import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { HomeAssistant } from './home-assistant/home-assistant';

export class IoTModule extends pulumi.ComponentResource {
    private readonly homeAssistant: HomeAssistant | undefined;

    getExports() {
        return {
            endpoints: {
                homeAssistant: this.homeAssistant?.endpointUrl,
            },
        };
    }

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super('orangelab:iot', name, {}, opts);

        if (rootConfig.isEnabled('home-assistant')) {
            this.homeAssistant = new HomeAssistant(
                'home-assistant',
                {
                    trustedProxies: [
                        rootConfig.clusterCidr,
                        rootConfig.serviceCidr,
                        '127.0.0.0/8',
                    ],
                },
                { parent: this },
            );
        }
    }
}
