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
    private configs: Record<string, pulumi.Config> = {};

    constructor() {
        this.processDeprecated();
    }

    private getConfig(name: string): pulumi.Config {
        return (this.configs[name] ??= new pulumi.Config(name));
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
        return this.getConfig(name).getBoolean('enabled') ?? false;
    }

    public isDebugEnabled(name: string): boolean {
        return this.getConfig(name).getBoolean('debug') ?? false;
    }

    public isBackupEnabled(appName: string, volumeName?: string): boolean {
        const volumePrefix = volumeName ? `${volumeName}/` : '';
        const appSetting = this.getConfig(appName).getBoolean(
            `${volumePrefix}backupVolume`,
        );
        return (
            appSetting ??
            this.getConfig('longhorn').getBoolean('backupAllVolumes') ??
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
        const prometheusEnabled = this.getConfig('prometheus').requireBoolean('enabled');

        const componentsEnabled = this.getConfig('prometheus').requireBoolean(
            'enableComponentMonitoring',
        );
        return prometheusEnabled && componentsEnabled;
    }

    public require(appName: string, dependencyName: string) {
        if (!this.isEnabled(dependencyName)) {
            throw new Error(`${appName}: missing dependency ${dependencyName}`);
        }
    }

    public getBoolean(appName: string, key: string): boolean | undefined {
        return this.getConfig(appName).getBoolean(key);
    }

    private getAppConfig(appName: string, key: string): string | undefined {
        return this.getConfig(appName).get(key);
    }

    private requireAppConfig(appName: string, key: string): string {
        return this.getConfig(appName).require(key);
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
        if (this.getAppConfig('longhorn', 'backupBucketCreate')) {
            console.warn('longhorn:backupBucketCreate is deprecated.');
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
            console.warn('tailscale:apiKey is deprecated. Use tailscale OAuth instead.');
        }
        if (this.getAppConfig('tailscale-operator', 'oauthClientId')) {
            console.warn(
                'tailscale-operator:oauthClientId is deprecated. Use tailscale:oauthClientId.',
            );
        }
        if (this.getAppConfig('tailscale-operator', 'oauthClientSecret')) {
            console.warn(
                'tailscale-operator:oauthClientSecret is deprecated. Use tailscale:oauthClientSecret.',
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
