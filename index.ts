import { AIModule } from './components/ai';
import { BitcoinModule } from './components/bitcoin';
import { DataModule } from './components/data';
import { IoTModule } from './components/iot';
import { MonitoringModule } from './components/monitoring';
import { rootConfig } from './components/root-config';
import { SystemModule } from './components/system';

const systemModule = new SystemModule('system');
export const system = systemModule.getExports();

if (rootConfig.isModuleEnabled('data')) {
    new DataModule('data', { dependsOn: systemModule });
}

let monitoringModule: MonitoringModule | undefined;
if (rootConfig.isModuleEnabled('monitoring')) {
    monitoringModule = new MonitoringModule('monitoring', { dependsOn: systemModule });
}
export const monitoring = monitoringModule?.getExports();

let iotModule: IoTModule | undefined;
if (rootConfig.isModuleEnabled('iot')) {
    iotModule = new IoTModule(
        'iot',
        {
            clusterCidr: systemModule.clusterCidr,
            serviceCidr: systemModule.serviceCidr,
        },
        { dependsOn: systemModule },
    );
}
export const iot = iotModule?.getExports();

let aiModule: AIModule | undefined;
if (rootConfig.isModuleEnabled('ai')) {
    aiModule = new AIModule('ai', { dependsOn: systemModule });
}
export const ai = aiModule?.getExports();

let bitcoinModule: BitcoinModule | undefined;
if (rootConfig.isModuleEnabled('bitcoin')) {
    bitcoinModule = new BitcoinModule('bitcoin', { dependsOn: systemModule });
}
export const bitcoin = bitcoinModule?.getExports();
