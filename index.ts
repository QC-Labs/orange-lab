import { AIModule } from './components/ai-module';
import { IoTModule } from './components/iot-module';
import { MonitoringModule } from './components/monitoring-module';
import { SystemModule } from './components/system-module';

const systemModule = new SystemModule('system');
export const system = {
    longhornUrl: systemModule.longhornUrl,
    tailscaleAgentKey: systemModule.tailscaleAgentKey,
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
export const monitoring = {
    grafanaUrl: monitoringModule.grafanaUrl,
};

const iotModule = new IoTModule(
    'iot',
    {
        domainName: systemModule.domainName,
    },
    { dependsOn: systemModule },
);
export const iot = {
    homeAssistantUrl: iotModule.homeAssistantUrl,
};

const aiModule = new AIModule(
    'ai',
    {
        domainName: systemModule.domainName,
        gpuStorageClass: systemModule.gpuStorageClass,
    },
    { dependsOn: systemModule },
);
export const ai = {
    ollamaUrl: aiModule.ollamaUrl,
    openWebUIUrl: aiModule.openWebUIUrl,
    kubeAIUrl: aiModule.kubeAIUrl,
};
