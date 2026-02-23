/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import 'tsconfig-paths/register';
import { config } from '@orangelab/config';
import { AIModule } from './components/ai';
import { BitcoinModule } from './components/bitcoin';
import { DataModule } from './components/data';
import { DevModule } from './components/dev';
import { HardwareModule } from './components/hardware';
import { IoTModule } from './components/iot';
import { MediaModule } from './components/media';
import { MonitoringModule } from './components/monitoring';
import { NetworkModule } from './components/network';
import { OfficeModule } from './components/office';
import { SecurityModule } from './components/security';
import { StorageModule } from './components/storage';

const networkModule = new NetworkModule('network');
const storageModule = new StorageModule('storage', { dependsOn: networkModule });

const dataModule = config.isModuleEnabled('data')
    ? new DataModule('data', { dependsOn: [networkModule, storageModule] })
    : undefined;

const hardwareModule = config.isModuleEnabled('hardware')
    ? new HardwareModule('hardware', { dependsOn: [networkModule, storageModule] })
    : undefined;

const baseModules = [
    networkModule,
    storageModule,
    ...(dataModule ? [dataModule] : []),
    ...(hardwareModule ? [hardwareModule] : []),
];

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

if (config.isModuleEnabled('media')) {
    const mediaModule = new MediaModule('media', { dependsOn: baseModules });
    exports.media = mediaModule.getExports();
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

if (config.isModuleEnabled('security')) {
    const securityModule = new SecurityModule('security', { dependsOn: baseModules });
    exports.security = securityModule.getExports();
}

if (config.isModuleEnabled('dev')) {
    const devModule = new DevModule('dev', { dependsOn: baseModules });
    exports.dev = devModule.getExports();
}
