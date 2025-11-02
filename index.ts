/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AIModule } from './components/ai';
import { BitcoinModule } from './components/bitcoin';
import { DataModule } from './components/data';
import { IoTModule } from './components/iot';
import { MonitoringModule } from './components/monitoring';
import { OfficeModule } from './components/office';
import { rootConfig } from './components/root-config';
import { SystemModule } from './components/system';

const systemModule = new SystemModule('system');
export const system = systemModule.getExports();

if (rootConfig.isModuleEnabled('data')) {
    new DataModule('data', { dependsOn: systemModule });
}

if (rootConfig.isModuleEnabled('monitoring')) {
    const monitoringModule = new MonitoringModule('monitoring', {
        dependsOn: systemModule,
    });
    exports.monitoring = monitoringModule.getExports();
}

if (rootConfig.isModuleEnabled('iot')) {
    const iotModule = new IoTModule('iot', {
        dependsOn: systemModule,
    });
    exports.iot = iotModule.getExports();
}

if (rootConfig.isModuleEnabled('ai')) {
    const aiModule = new AIModule('ai', { dependsOn: systemModule });
    exports.ai = aiModule.getExports();
}

if (rootConfig.isModuleEnabled('bitcoin')) {
    const bitcoinModule = new BitcoinModule('bitcoin', { dependsOn: systemModule });
    exports.bitcoin = bitcoinModule.getExports();
}

if (rootConfig.isModuleEnabled('office')) {
    const officeModule = new OfficeModule('office', { dependsOn: systemModule });
    exports.office = officeModule.getExports();
}
