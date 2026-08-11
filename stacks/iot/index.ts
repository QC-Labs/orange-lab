import { config } from '@orangelab/pulumi';
import {
    HomeAssistant,
    HomeAssistantDevice,
} from './components/home-assistant/home-assistant';

const homeAssistant = config.isEnabled('home-assistant')
    ? new HomeAssistant('home-assistant', {
          trustedProxies: (config.get('home-assistant', 'trustedProxies') ?? '')
              .split(',')
              .map(s => s.trim()),
          devices: config.getObject('home-assistant', 'devices') as
              | HomeAssistantDevice[]
              | undefined,
      })
    : undefined;

export const endpoints = {
    homeAssistant: homeAssistant?.endpointUrl,
};
