import { config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';
import { HomeAssistant } from './apps/home-assistant/home-assistant';

const iot = new pulumi.ComponentResource('orangelab:iot', 'iot', {});

const homeAssistant = config.isEnabled('home-assistant')
    ? new HomeAssistant(
          'home-assistant',
          {
              trustedProxies: (config.get('home-assistant', 'trustedProxies') ?? '')
                  .split(',')
                  .map(s => s.trim()),
          },
          { parent: iot },
      )
    : undefined;

export const endpoints = {
    homeAssistant: homeAssistant?.endpointUrl,
};
