import { AIModule } from './components/ai';
import { BitcoinModule } from './components/bitcoin';
import { IoTModule } from './components/iot';
import { MonitoringModule } from './components/monitoring';
import { SystemModule } from './components/system';

const systemModule = new SystemModule('system');
export const system = systemModule.getExports();

const monitoringModule = new MonitoringModule('monitoring', { dependsOn: systemModule });
export const monitoring = monitoringModule.getExports();

const iotModule = new IoTModule(
    'iot',
    {
        clusterCidr: systemModule.clusterCidr,
        serviceCidr: systemModule.serviceCidr,
    },
    { dependsOn: systemModule },
);
export const iot = iotModule.getExports();

const aiModule = new AIModule('ai', { dependsOn: systemModule });
export const ai = aiModule.getExports();

const bitcoinModule = new BitcoinModule('bitcoin', { dependsOn: systemModule });
export const bitcoin = bitcoinModule.getExports();
