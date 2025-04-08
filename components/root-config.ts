import * as pulumi from '@pulumi/pulumi';

class RootConfig {
    private globalConfig = new pulumi.Config('orangelab');

    public isEnabled(name: string): boolean {
        const config = new pulumi.Config(name);
        if (this.globalConfig.getBoolean(name)) {
            // eslint-disable-next-line no-console
            console.warn(`orangelab:${name} is deprecated. Use ${name}:enabled instead.`);
        }
        return (
            this.globalConfig.getBoolean(name) ?? config.getBoolean('enabled') ?? false
        );
    }

    public isBackupEnabled(appName: string, volumeName?: string): boolean {
        const config = new pulumi.Config(appName);
        const volumePrefix = volumeName ? `${volumeName}/` : '';
        const appSetting = config.getBoolean(`${volumePrefix}backupVolume`);
        return appSetting ?? new pulumi.Config('longhorn').getBoolean('backupAllVolumes') ?? false;
    }

    public enableMonitoring() {
        const config = new pulumi.Config('prometheus');
        const prometheusEnabled = config.requireBoolean('enabled');
        const componentsEnabled = config.requireBoolean('enableComponentMonitoring');
        return prometheusEnabled && componentsEnabled;
    }

    public get(key: string): string | undefined {
        return this.globalConfig.get(key);
    }
}

export const rootConfig = new RootConfig();
