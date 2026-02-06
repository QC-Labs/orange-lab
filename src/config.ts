/* eslint-disable no-console */
import * as pulumi from '@pulumi/pulumi';
import { StorageType } from './types';

const moduleDependencies: Record<string, string[]> = {
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

class Config {
    private configs: Record<string, pulumi.Config> = {};

    constructor() {
        this.processDeprecated();
    }

    private getConfig(name: string): pulumi.Config {
        return (this.configs[name] ??= new pulumi.Config(name));
    }

    public helmHistoryLimit = 5;
    public storageClass = {
        Default: 'longhorn',
        GPU: 'longhorn-gpu',
        Large: 'longhorn-large',
        Database: 'longhorn',
    };
    public customDomain = this.get('orangelab', 'customDomain');
    public tailnetDomain = this.require('tailscale', 'tailnet');
    public clusterCidr = this.require('k3s', 'clusterCidr');
    public serviceCidr = this.require('k3s', 'serviceCidr');

    public isEnabled(name: string): boolean {
        return this.getBoolean(name, 'enabled') ?? false;
    }

    public isDebugEnabled(name: string): boolean {
        return this.getBoolean(name, 'debug') ?? false;
    }

    public isBackupEnabled(appName: string, volumeName?: string): boolean {
        const volumePrefix = volumeName ? `${volumeName}/` : '';
        const appSetting = this.getBoolean(appName, `${volumePrefix}backupVolume`);
        return appSetting ?? this.getBoolean('longhorn', 'backupAllVolumes') ?? false;
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
        const prometheusEnabled = this.requireBoolean('prometheus', 'enabled');

        const componentsEnabled = this.requireBoolean(
            'prometheus',
            'enableComponentMonitoring',
        );
        return prometheusEnabled && componentsEnabled;
    }

    public requireEnabled(appName: string, dependencyName: string) {
        if (!this.isEnabled(dependencyName)) {
            throw new Error(`${appName}: missing dependency ${dependencyName}`);
        }
    }

    public get(appName: string, key: string): string | undefined {
        return this.getConfig(appName).get(key);
    }

    public require(appName: string, key: string): string {
        return this.getConfig(appName).require(key);
    }

    public getSecret(appName: string, key: string): pulumi.Output<string> | undefined {
        return this.getConfig(appName).getSecret(key);
    }

    public requireSecret(appName: string, key: string): pulumi.Output<string> {
        return this.getConfig(appName).requireSecret(key);
    }

    public getNumber(appName: string, key: string): number | undefined {
        return this.getConfig(appName).getNumber(key);
    }

    public requireNumber(appName: string, key: string): number {
        return this.getConfig(appName).requireNumber(key);
    }

    public getBoolean(appName: string, key: string): boolean | undefined {
        return this.getConfig(appName).getBoolean(key);
    }

    public requireBoolean(appName: string, key: string): boolean {
        return this.getConfig(appName).requireBoolean(key);
    }

    private processDeprecated() {
        if (this.get('longhorn', 'backupAccessKeyId')) {
            console.warn('longhorn:backupAccessKeyId is deprecated.');
        }
        if (this.get('longhorn', 'backupAccessKeySecret')) {
            console.warn('longhorn:backupAccessKeySecret is deprecated.');
        }
        if (this.get('longhorn', 'backupTarget')) {
            console.warn(
                'longhorn:backupTarget is deprecated. Use longhorn:backupBucket instead.',
            );
        }
        if (this.get('longhorn', 'backupBucketCreate')) {
            console.warn('longhorn:backupBucketCreate is deprecated.');
        }
        if (this.get('grafana', 'url')) {
            console.warn('grafana:url is not used anymore');
        }
        if (this.get('grafana', 'auth')) {
            console.warn('grafana:auth is not used anymore');
        }
        if (this.get('orangelab', 'storageClass')) {
            console.warn(
                'orangelab:storageClass is deprecated. Use per-app <app>:storageClass if needed.',
            );
        }
        if (this.get('orangelab', 'storageClass-gpu')) {
            console.warn(
                'orangelab:storageClass-gpu is deprecated. Use per-app <app>:storageClass if needed.',
            );
        }
        if (this.get('orangelab', 'storageClass-large')) {
            console.warn(
                'orangelab:storageClass-large is deprecated. Use per-app <app>:storageClass if needed.',
            );
        }
        if (this.get('orangelab', 'storageClass-database')) {
            console.warn(
                'orangelab:storageClass-database is deprecated. Use per-app <app>:storageClass if needed.',
            );
        }
        if (this.get('mempool', 'db/maintenance')) {
            console.warn(
                'mempool:db/maintenance is deprecated. Use mempool:db/disableAuth instead.',
            );
        }
        if (this.get('tailscale', 'apiKey')) {
            console.warn('tailscale:apiKey is deprecated. Use tailscale OAuth instead.');
        }
        if (this.get('tailscale-operator', 'oauthClientId')) {
            console.warn(
                'tailscale-operator:oauthClientId is deprecated. Use tailscale:oauthClientId.',
            );
        }
        if (this.get('tailscale-operator', 'oauthClientSecret')) {
            console.warn(
                'tailscale-operator:oauthClientSecret is deprecated. Use tailscale:oauthClientSecret.',
            );
        }
        if (this.get('bitcoin-core', 'version')) {
            console.warn(
                'bitcoin-core:version is deprecated. Use bitcoin-core:image instead.',
            );
        }
        if (this.get('bitcoin-knots', 'version')) {
            console.warn(
                'bitcoin-knots:version is deprecated. Use bitcoin-knots:image instead.',
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

export const config = new Config();
