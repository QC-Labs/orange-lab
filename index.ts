import * as pulumi from '@pulumi/pulumi';
import { Longhorn } from './components/longhorn';
import { Prometheus } from './components/prometheus';
import { Tailscale } from './components/tailscale';
import { TailscaleOperator } from './components/tailscale-operator';
import { HomeAssistant } from './components/home-assistant';
import { Ollama } from './components/ollama';
import { NvidiaGPUOperator } from './components/nvidia-gpu-operator';
import { OpenWebUI } from './components/open-webui';

const config = new pulumi.Config('orangelab');
const configK3s = new pulumi.Config('k3s');

const tailscale = new Tailscale('tailscale');
export const tailscaleServerKey = tailscale.serverKey;
export const tailscaleAgentKey = tailscale.agentKey;
export const tailscaleDomain = tailscale.tailnet;

if (config.requireBoolean('tailscale-operator')) {
    new TailscaleOperator('tailscale-operator');
}

const longhorn = config.requireBoolean('longhorn')
    ? new Longhorn('longhorn', { domainName: tailscale.tailnet })
    : undefined;
export const longhornUrl = longhorn?.endpointUrl;

let prometheus;
if (config.requireBoolean('prometheus')) {
    prometheus = new Prometheus(
        'prometheus',
        { domainName: tailscale.tailnet },
        { dependsOn: longhorn },
    );
}
export const prometheusEndpointUrl = prometheus?.grafanaEndpointUrl;

let homeAssistant;
if (config.requireBoolean('home-assistant')) {
    homeAssistant = new HomeAssistant(
        'home-assistant',
        {
            domainName: tailscale.tailnet,
            trustedProxies: [
                configK3s.require('clusterCidr'),
                configK3s.require('serviceCidr'),
                '127.0.0.0/8',
            ],
        },
        { dependsOn: longhorn },
    );
}
export const homeAssistantEndpointUrl = homeAssistant?.endpointUrl;

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
export const ollamaUrl = ollama?.endpointUrl;
export const ollamaClusterUrl = ollama?.serviceUrl;

let openWebUI;
if (config.requireBoolean('open-webui') && ollama) {
    openWebUI = new OpenWebUI(
        'open-webui',
        {
            domainName: tailscale.tailnet,
            ollamaUrl: ollama.serviceUrl,
        },
        { dependsOn: ollama },
    );
}
export const openWebUIUrl = openWebUI?.endpointUrl;
