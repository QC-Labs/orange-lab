import * as pulumi from '@pulumi/pulumi';
import { AIModule } from './components/ai';
import { BitcoinModule } from './components/bitcoin';
import { IoTModule } from './components/iot';
import { MonitoringModule } from './components/monitoring';
import { SystemModule } from './components/system';

const systemModule = new SystemModule('system');
export const system = {
    longhornUrl: systemModule.longhorn?.endpointUrl,
    minioUrl: systemModule.minio?.endpointUrl,
    minioS3ApiClusterUrl: systemModule.minio?.s3ApiClusterUrl,
    minioS3ApiUrl: systemModule.minio?.s3ApiUrl,
    minioS3WebUrl: systemModule.minio?.s3WebUrl,
    minioUsers: systemModule.minio?.users,
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
    beszelUrl: monitoringModule.beszel?.endpointUrl,
    grafanaUrl: monitoringModule.prometheus?.grafanaEndpointUrl,
};

const iotModule = new IoTModule(
    'iot',
    {
        domainName: systemModule.domainName,
        clusterCidr: systemModule.clusterCidr,
        serviceCidr: systemModule.serviceCidr,
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
    sdnextUrl: aiModule.sdnext?.endpointUrl,
    sdnextClusterUrl: aiModule.sdnext?.serviceUrl,
};

const bitcoinModule = new BitcoinModule(
    'bitcoin',
    {
        domainName: systemModule.domainName,
    },
    { dependsOn: systemModule },
);
export const bitcoin = {
    bitcoinUsers: Object.fromEntries(
        Object.entries(bitcoinModule.bitcoinUsers).map(([user, password]) => [
            user,
            pulumi.secret(password),
        ]),
    ),
    bitcoinCoreUrl: bitcoinModule.bitcoinCore?.rpcUrl,
    bitcoinCoreClusterUrl: bitcoinModule.bitcoinCore?.rpcClusterUrl,
    bitcoinKnotsUrl: bitcoinModule.bitcoinKnots?.rpcUrl,
    bitcoinKnotsClusterUrl: bitcoinModule.bitcoinKnots?.rpcClusterUrl,
    electrsUrl: bitcoinModule.electrs?.rpcUrl,
    electrsClusterUrl: bitcoinModule.electrs?.rpcClusterUrl,
};
