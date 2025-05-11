import * as pulumi from '@pulumi/pulumi';

class RootConfig {
    public longhorn = {
        replicaCount: parseInt(this.getAppConfig('longhorn', 'replicaCount')),
    };

    public isEnabled(name: string): boolean {
        const config = new pulumi.Config(name);
        return config.getBoolean('enabled') ?? false;
    }

    public isBackupEnabled(appName: string, volumeName?: string): boolean {
        const config = new pulumi.Config(appName);
        const volumePrefix = volumeName ? `${volumeName}/` : '';
        const appSetting = config.getBoolean(`${volumePrefix}backupVolume`);
        return (
            appSetting ??
            new pulumi.Config('longhorn').getBoolean('backupAllVolumes') ??
            false
        );
    }

    public enableMonitoring() {
        const config = new pulumi.Config('prometheus');
        const prometheusEnabled = config.requireBoolean('enabled');
        const componentsEnabled = config.requireBoolean('enableComponentMonitoring');
        return prometheusEnabled && componentsEnabled;
    }

    private getAppConfig(appName: string, key: string): string {
        const config = new pulumi.Config(appName);
        return config.require(key);
    }
}

export const rootConfig = new RootConfig();
