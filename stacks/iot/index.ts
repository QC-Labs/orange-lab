import { config } from '@orangelab/pulumi';
import { HomeAssistant } from './components/home-assistant/home-assistant';

const homeAssistant = config.isEnabled('home-assistant')
    ? new HomeAssistant('home-assistant', {
          trustedProxies: (config.get('home-assistant', 'trustedProxies') ?? '')
              .split(',')
              .map(s => s.trim()),
      })
    : undefined;

export const endpoints = {
    homeAssistant: homeAssistant?.endpointUrl,
};
