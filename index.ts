import * as pulumi from '@pulumi/pulumi';
import { KubeAi } from './components/ai/kubeai';
import { Ollama } from './components/ai/ollama';
import { OpenWebUI } from './components/ai/open-webui';
import { HomeAssistant } from './components/iot/home-assistant';
import { SystemModule } from './components/system-module';

export const system = new SystemModule('system');
export const tailscaleServerKey = system.tailscaleServerKey;
export const tailscaleAgentKey = system.tailscaleAgentKey;
export const tailscaleDomain = system.domainName;
export const longhornUrl = system.longhornUrl;
export const grafanaUrl = system.grafanaUrl;

/**
 * IoT
 */

let homeAssistant;
if (system.isModuleEnabled('home-assistant')) {
    const configK3s = new pulumi.Config('k3s');
    homeAssistant = new HomeAssistant(
        'home-assistant',
        {
            domainName: system.domainName,
            trustedProxies: [
                configK3s.require('clusterCidr'),
                configK3s.require('serviceCidr'),
                '127.0.0.0/8',
            ],
        },
        { dependsOn: system },
    );
}
export const iotHomeAssistantUrl = homeAssistant?.endpointUrl;

/**
 * AI
 */

let kubeAI;
if (system.isModuleEnabled('kubeai')) {
    kubeAI = new KubeAi(
        'kubeai',
        {
            domainName: system.domainName,
        },
        { dependsOn: [system] },
    );
}
export const aiKubeAIUrl = kubeAI?.endpointUrl;
export const aiKubeAIInternalUrl = kubeAI?.serviceUrl;

let ollama;
if (system.isModuleEnabled('ollama')) {
    ollama = new Ollama(
        'ollama',
        {
            domainName: system.domainName,
            storageClass: system.gpuStorageClass,
        },
        { dependsOn: [system] },
    );
}
export const aiOllamaUrl = ollama?.endpointUrl;
export const aiOllamaInternalUrl = ollama?.serviceUrl;

let openWebUI;
if (system.isModuleEnabled('open-webui') && ollama) {
    openWebUI = new OpenWebUI(
        'open-webui',
        {
            domainName: system.domainName,
            ollamaUrl: ollama.serviceUrl,
            openAiUrl: kubeAI?.serviceUrl,
            storageClass: system.gpuStorageClass,
        },
        { dependsOn: [ollama, system] },
    );
}
export const aiOpenWebUIUrl = openWebUI?.endpointUrl;
