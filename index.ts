import { AIModule } from './components/ai-module';
import { IoTModule } from './components/iot-module';
import { SystemModule } from './components/system-module';

const system = new SystemModule('system');
export const tailscaleServerKey = system.tailscaleServerKey;
export const tailscaleAgentKey = system.tailscaleAgentKey;
export const tailscaleDomain = system.domainName;
export const longhornUrl = system.longhornUrl;
export const grafanaUrl = system.grafanaUrl;

const iotModule = new IoTModule(
    'iot',
    {
        domainName: system.domainName,
    },
    { dependsOn: [system] },
);
export const iotHomeAssistantUrl = iotModule.homeAssistantUrl;

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
