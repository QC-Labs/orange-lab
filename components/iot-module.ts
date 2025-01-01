import * as pulumi from '@pulumi/pulumi';
import { HomeAssistant } from './iot/home-assistant';

interface IoTModuleArgs {
    domainName: string;
}

export class IoTModule extends pulumi.ComponentResource {
    homeAssistantUrl: string | undefined;

    private config = new pulumi.Config('orangelab');
    private homeAssistant: HomeAssistant | undefined;

    constructor(
        name: string,
        args: IoTModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:IoT', name, args, opts);

        if (this.isModuleEnabled('home-assistant')) {
            const configK3s = new pulumi.Config('k3s');
            this.homeAssistant = new HomeAssistant('home-assistant', {
                domainName: args.domainName,
                trustedProxies: [
                    configK3s.require('clusterCidr'),
                    configK3s.require('serviceCidr'),
                    '127.0.0.0/8',
                ],
            });
            this.homeAssistantUrl = this.homeAssistant.endpointUrl;
        }
    }

    public isModuleEnabled(name: string): boolean {
        return this.config.requireBoolean(name);
    }
}
