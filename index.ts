/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { config } from '@orangelab/pulumi';
import { DataModule } from './components/data';
import { DevModule } from './components/dev';
import { HardwareModule } from './components/hardware';
import { MonitoringModule } from './components/monitoring';
import { NetworkModule } from './components/network';
import { SecurityModule } from './components/security';
import { StorageModule } from './components/storage';

const networkModule = new NetworkModule('network');
exports.network = networkModule.getExports();

const storageModule = new StorageModule('storage', { dependsOn: networkModule });
exports.storage = storageModule.getExports();

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

if (config.isModuleEnabled('security')) {
    const securityModule = new SecurityModule('security', { dependsOn: baseModules });
    exports.security = securityModule.getExports();
}

if (config.isModuleEnabled('dev')) {
    const devModule = new DevModule('dev', { dependsOn: baseModules });
    exports.dev = devModule.getExports();
}
