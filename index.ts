import { AIModule } from './components/ai';
import { IoTModule } from './components/iot';
import { MonitoringModule } from './components/monitoring';
import { SystemModule } from './components/system';

const systemModule = new SystemModule('system');
export const system = {
    longhornUrl: systemModule.longhorn?.endpointUrl,
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
    grafanaUrl: monitoringModule.prometheus?.grafanaEndpointUrl,
};

const iotModule = new IoTModule(
    'iot',
    {
        domainName: systemModule.domainName,
    },
    { dependsOn: systemModule },
);
export const iot = {
    homeAssistantUrl: iotModule.homeAssistant?.endpointUrl,
};

const aiModule = new AIModule(
    'ai',
    {
        domainName: systemModule.domainName,
    },
    { dependsOn: systemModule },
);
export const ai = {
    ollamaUrl: aiModule.ollama?.endpointUrl,
    openWebUIUrl: aiModule.openWebUI?.endpointUrl,
    kubeAIClusterUrl: aiModule.kubeAI?.serviceUrl,
    automatic1111Url: aiModule.automatic1111?.endpointUrl,
    automatic1111ClusterUrl: aiModule.automatic1111?.serviceUrl,
};
