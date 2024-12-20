import * as pulumi from '@pulumi/pulumi';
import { Ollama } from './components/ai/ollama';
import { OpenWebUI } from './components/ai/open-webui';
import { HomeAssistant } from './components/iot/home-assistant';
import { Longhorn } from './components/longhorn';
import { Prometheus } from './components/monitoring/prometheus';
import { NvidiaGPUOperator } from './components/nvidia-gpu-operator';
import { Tailscale } from './components/tailscale';
import { TailscaleOperator } from './components/tailscale-operator';

const config = new pulumi.Config('orangelab');

/**
 * System
 */

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

if (config.requireBoolean('nvidia-gpu-operator')) {
    new NvidiaGPUOperator('nvidia-gpu-operator');
}

/**
 * Monitoring
 */

let prometheus;
if (config.requireBoolean('prometheus')) {
    prometheus = new Prometheus(
        'prometheus',
        { domainName: tailscale.tailnet },
        { dependsOn: longhorn },
    );
}
export const prometheusUrl = prometheus?.grafanaEndpointUrl;

/**
 * IoT
 */

let homeAssistant;
if (config.requireBoolean('home-assistant')) {
    const configK3s = new pulumi.Config('k3s');
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
export const iotHomeAssistantUrl = homeAssistant?.endpointUrl;

/**
 * AI
 */

let ollama;
if (config.requireBoolean('ollama') && longhorn) {
    ollama = new Ollama(
        'ollama',
        {
            domainName: tailscale.tailnet,
            storageClass: longhorn.gpuStorageClass,
        },
        { dependsOn: [longhorn] },
    );
}
export const aiOllamaUrl = ollama?.endpointUrl;
export const aiOllamaInternalUrl = ollama?.serviceUrl;

let openWebUI;
if (config.requireBoolean('open-webui') && ollama && longhorn) {
    openWebUI = new OpenWebUI(
        'open-webui',
        {
            domainName: tailscale.tailnet,
            ollamaUrl: ollama.serviceUrl,
            storageClass: longhorn.gpuStorageClass,
        },
        { dependsOn: [ollama, longhorn] },
    );
}
export const aiOpenWebUIUrl = openWebUI?.endpointUrl;
