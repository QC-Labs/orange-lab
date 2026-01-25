/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import 'tsconfig-paths/register';
import { AIModule } from './components/ai';
import { BitcoinModule } from './components/bitcoin';
import { DataModule } from './components/data';
import { IoTModule } from './components/iot';
import { MonitoringModule } from './components/monitoring';
import { OfficeModule } from './components/office';
import { config } from '@orangelab/config';
import { SystemModule } from './components/system';

const systemModule = new SystemModule('system');
export const system = systemModule.getExports();

const dataModule = config.isModuleEnabled('data')
    ? new DataModule('data', { dependsOn: systemModule })
    : undefined;

const baseModules = [systemModule, ...(dataModule ? [dataModule] : [])];

if (config.isModuleEnabled('monitoring')) {
    const monitoringModule = new MonitoringModule('monitoring', {
        dependsOn: baseModules,
    });
    exports.monitoring = monitoringModule.getExports();
}

if (config.isModuleEnabled('iot')) {
    const iotModule = new IoTModule('iot', {
        dependsOn: baseModules,
    });
    exports.iot = iotModule.getExports();
}

if (config.isModuleEnabled('ai')) {
    const aiModule = new AIModule('ai', { dependsOn: baseModules });
    exports.ai = aiModule.getExports();
}

if (config.isModuleEnabled('bitcoin')) {
    const bitcoinModule = new BitcoinModule('bitcoin', { dependsOn: baseModules });
    exports.bitcoin = bitcoinModule.getExports();
}

if (config.isModuleEnabled('office')) {
    const officeModule = new OfficeModule('office', { dependsOn: baseModules });
    exports.office = officeModule.getExports();
}
