/* eslint-disable no-console */
import * as pulumi from '@pulumi/pulumi';
import { StorageType } from './types';

export const moduleDependencies: Record<string, string[]> = {
    ai: ['automatic1111', 'invokeai', 'kubeai', 'n8n', 'ollama', 'open-webui', 'sdnext'],
    bitcoin: ['bitcoin-core', 'bitcoin-knots', 'electrs', 'mempool'],
    data: ['cloudnative-pg', 'mariadb-operator'],
    iot: ['home-assistant'],
    monitoring: ['beszel', 'prometheus'],
    office: ['nextcloud'],
    system: [
        'amd-gpu-operator',
        'cert-manager',
        'debug',
        'longhorn',
        'minio',
        'nfd',
        'nvidia-gpu-operator',
        'tailscale',
        'tailscale-operator',
        'traefik',
    ],
};

class RootConfig {
    constructor() {
        this.processDeprecated();
    }

    public longhorn = {
        replicaCount: parseInt(this.requireAppConfig('longhorn', 'replicaCount')),
        replicaAutoBalance: this.requireAppConfig('longhorn', 'replicaAutoBalance'),
    };

    public helmHistoryLimit = 5;
    public storageClass = {
        Default: 'longhorn',
        GPU: 'longhorn-gpu',
        Large: 'longhorn-large',
        Database: 'longhorn',
    };
    public customDomain = this.getAppConfig('orangelab', 'customDomain');
    public tailnetDomain = this.requireAppConfig('tailscale', 'tailnet');
    public certManager = {
        clusterIssuer: this.requireAppConfig('cert-manager', 'clusterIssuer'),
    };
    public clusterCidr = this.requireAppConfig('k3s', 'clusterCidr');
    public serviceCidr = this.requireAppConfig('k3s', 'serviceCidr');

    public isEnabled(name: string): boolean {
        const config = new pulumi.Config(name);
        return config.getBoolean('enabled') ?? false;
    }

    public isDebugEnabled(name: string): boolean {
        const config = new pulumi.Config(name);
        return config.getBoolean('debug') ?? false;
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

    public getStorageClass(storageType?: StorageType): string {
        switch (storageType) {
            case StorageType.GPU:
                return this.storageClass.GPU;
            case StorageType.Large:
                return this.storageClass.Large;
            case StorageType.Database:
                return this.storageClass.Database;
            default:
                return this.storageClass.Default;
        }
    }

    public enableMonitoring() {
        const config = new pulumi.Config('prometheus');
        const prometheusEnabled = config.requireBoolean('enabled');

        const componentsEnabled = config.requireBoolean('enableComponentMonitoring');
        return prometheusEnabled && componentsEnabled;
    }

    public require(appName: string, dependencyName: string) {
        const config = new pulumi.Config(dependencyName);
        if (config.require('enabled') !== 'true') {
            throw new Error(`${appName}: missing dependency ${dependencyName}`);
        }
    }

    private getAppConfig(appName: string, key: string): string | undefined {
        const config = new pulumi.Config(appName);
        return config.get(key);
    }

    private requireAppConfig(appName: string, key: string): string {
        const config = new pulumi.Config(appName);
        return config.require(key);
    }

    private processDeprecated() {
        if (this.getAppConfig('longhorn', 'backupAccessKeyId')) {
            console.warn('longhorn:backupAccessKeyId is deprecated.');
        }
        if (this.getAppConfig('longhorn', 'backupAccessKeySecret')) {
            console.warn('longhorn:backupAccessKeySecret is deprecated.');
        }
        if (this.getAppConfig('longhorn', 'backupTarget')) {
            console.warn(
                'longhorn:backupTarget is deprecated. Use longhorn:backupBucket instead.',
            );
        }
        if (this.getAppConfig('grafana', 'url')) {
            console.warn('grafana:url is not used anymore');
        }
        if (this.getAppConfig('grafana', 'auth')) {
            console.warn('grafana:auth is not used anymore');
        }
        if (this.getAppConfig('orangelab', 'storageClass')) {
            console.warn(
                'orangelab:storageClass is deprecated. Use per-app <app>:storageClass if needed.',
            );
        }
        if (this.getAppConfig('orangelab', 'storageClass-gpu')) {
            console.warn(
                'orangelab:storageClass-gpu is deprecated. Use per-app <app>:storageClass if needed.',
            );
        }
        if (this.getAppConfig('orangelab', 'storageClass-large')) {
            console.warn(
                'orangelab:storageClass-large is deprecated. Use per-app <app>:storageClass if needed.',
            );
        }
        if (this.getAppConfig('orangelab', 'storageClass-database')) {
            console.warn(
                'orangelab:storageClass-database is deprecated. Use per-app <app>:storageClass if needed.',
            );
        }
        if (this.getAppConfig('mempool', 'db/maintenance')) {
            console.warn(
                'mempool:db/maintenance is deprecated. Use mempool:db/disableAuth instead.',
            );
        }
        if (this.getAppConfig('tailscale', 'apiKey')) {
            console.warn('tailscale:apiKey is deprecated. Use OAuth instead.');
        }
        if (this.getAppConfig('tailscale-operator', 'oauthClientId')) {
            console.warn(
                'tailscale-operator:oauthClientId is deprecated. Create tailscale:oauthClientId.',
            );
        }
        if (this.getAppConfig('tailscale-operator', 'oauthClientSecret')) {
            console.warn(
                'tailscale-operator:oauthClientSecret is deprecated. Create tailscale:oauthClientSecret.',
            );
        }
    }

    /**
     * Returns true if any component in the given module is enabled.
     */
    public isModuleEnabled(module: string): boolean {
        const deps = moduleDependencies[module];
        return deps.some(dep => this.isEnabled(dep));
    }
}

export const rootConfig = new RootConfig();
