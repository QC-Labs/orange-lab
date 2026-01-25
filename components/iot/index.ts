import * as pulumi from '@pulumi/pulumi';
import { config } from '@orangelab/config';
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

        if (config.isEnabled('home-assistant')) {
            this.homeAssistant = new HomeAssistant(
                'home-assistant',
                {
                    trustedProxies: [
                        config.clusterCidr,
                        config.serviceCidr,
                        '127.0.0.0/8',
                    ],
                },
                { parent: this },
            );
        }
    }
}
