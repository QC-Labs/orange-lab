import { AIModule } from './components/ai-module';
import { IoTModule } from './components/iot-module';
import { MonitoringModule } from './components/monitoring-module';
import { SystemModule } from './components/system-module';

const systemModule = new SystemModule('system');
export const tailscaleServerKey = systemModule.tailscaleServerKey;
export const tailscaleAgentKey = systemModule.tailscaleAgentKey;
export const tailscaleDomain = systemModule.domainName;
export const longhornUrl = systemModule.longhornUrl;
export const system = {
    longhornUrl: systemModule.longhornUrl,
    tailscaleServerKey: systemModule.tailscaleServerKey,
    tailscaleDomain: systemModule.domainName,
};

const monitoringModule = new MonitoringModule(
    'monitoring',
    {
        domainName: systemModule.domainName,
    },
    { dependsOn: systemModule },
);
export const monitoringGrafanaUrl = monitoringModule.grafanaUrl;
export const monitoring = monitoringModule;

const iotModule = new IoTModule(
    'iot',
    {
        domainName: systemModule.domainName,
    },
    { dependsOn: systemModule },
);
export const iotHomeAssistantUrl = iotModule.homeAssistantUrl;

const aiModule = new AIModule(
    'ai',
    {
        domainName: systemModule.domainName,
        gpuStorageClass: systemModule.gpuStorageClass,
    },
    { dependsOn: systemModule },
);
export const aiOllamaUrl = aiModule.ollamaUrl;
export const aiKubeAIUrl = aiModule.kubeAIUrl;
export const aiOpenWebUIUrl = aiModule.openWebUIUrl;
