import * as pulumi from '@pulumi/pulumi';
import { Longhorn } from './components/longhorn';
import { Prometheus } from './components/prometheus';
import { Tailscale } from './components/tailscale';
import { TailscaleOperator } from './components/tailscale-operator';
import { HomeAssistant } from './components/home-assistant';
import { Ollama } from './components/ollama';
import { NvidiaGPUOperator } from './components/nvidia-gpu-operator';
import { OpenWebUI } from './components/open-webui';
import { NVidiaDevicePlugin } from './components/nvidia-device-plugin';

const config = new pulumi.Config('orangelab');
const configK3s = new pulumi.Config('k3s');

const tailscale = new Tailscale('tailscale');

if (config.requireBoolean('tailscale-operator')) {
    new TailscaleOperator('tailscale-operator');
}

const longhorn = config.requireBoolean('longhorn') ? new Longhorn('longhorn') : undefined;

if (config.requireBoolean('prometheus')) {
    new Prometheus('prometheus', {}, { dependsOn: longhorn });
}

if (config.requireBoolean('home-assistant')) {
    new HomeAssistant(
        'home-assistant',
        {
            trustedProxies: [
                configK3s.require('clusterCidr'),
                configK3s.require('serviceCidr'),
                '127.0.0.0/8',
            ],
        },
        { dependsOn: longhorn },
    );
}

if (config.requireBoolean('nvidia-device-plugin')) {
    new NVidiaDevicePlugin('nvidia-device-plugin');
}

if (config.requireBoolean('nvidia-gpu-operator')) {
    new NvidiaGPUOperator('nvidia-gpu-operator');
}

const ollama = config.requireBoolean('ollama')
    ? new Ollama(
          'ollama',
          {
              domainName: tailscale.tailnet,
          },
          { dependsOn: longhorn },
      )
    : undefined;

if (config.requireBoolean('open-webui') && ollama) {
    new OpenWebUI(
        'open-webui',
        {
            ollamaUrl: ollama.endpointUrl,
        },
        { dependsOn: ollama },
    );
}

export const tailscaleServerKey = tailscale.serverKey;
export const tailscaleAgentKey = tailscale.agentKey;
export const tailscaleDomain = tailscale.tailnet;
export const ollamaUrl = ollama?.endpointUrl;
