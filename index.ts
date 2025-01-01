import * as pulumi from '@pulumi/pulumi';
import { AIModule } from './components/ai-module';
import { HomeAssistant } from './components/iot/home-assistant';
import { SystemModule } from './components/system-module';

const system = new SystemModule('system');
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

const aiModule = new AIModule(
    'ai',
    {
        domainName: system.domainName,
        gpuStorageClass: system.gpuStorageClass,
    },
    { dependsOn: [system] },
);
export const aiOllamaUrl = aiModule.ollamaUrl;
export const aiKubeAIUrl = aiModule.kubeAIUrl;
export const aiOpenWebUIUrl = aiModule.openWebUIUrl;
