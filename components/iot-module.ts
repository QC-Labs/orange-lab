import * as pulumi from '@pulumi/pulumi';
import { HomeAssistant } from './iot/home-assistant';
import { rootConfig } from './root-config';

interface IoTModuleArgs {
    domainName: string;
}

export class IoTModule extends pulumi.ComponentResource {
    homeAssistantUrl: string | undefined;

    private homeAssistant: HomeAssistant | undefined;

    constructor(
        name: string,
        args: IoTModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:iot', name, args, opts);

        if (rootConfig.isEnabled('home-assistant')) {
            const configK3s = new pulumi.Config('k3s');
            this.homeAssistant = new HomeAssistant(
                'home-assistant',
                {
                    domainName: args.domainName,
                    trustedProxies: [
                        configK3s.require('clusterCidr'),
                        configK3s.require('serviceCidr'),
                        '127.0.0.0/8',
                    ],
                },
                { parent: this },
            );
            this.homeAssistantUrl = this.homeAssistant.endpointUrl;
        }
    }
}
