import * as kubernetes from '@pulumi/kubernetes';
import { ConfigMap } from '@pulumi/kubernetes/core/v1';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { LonghornVolume } from './longhorn-volume';
import { Metadata } from './metadata';
import { rootConfig } from './root-config';
import { ConfigVolume, LocalVolume, PersistentVolume, StorageType } from './types';

export class Storage extends pulumi.ComponentResource {
    private readonly longhornVolumes = new Map<string, LonghornVolume>();
    private readonly volumes = new Map<string, kubernetes.types.input.core.v1.Volume>();
    private readonly config: pulumi.Config;
    private readonly namespace: string;
    private readonly metadata: Metadata;

    constructor(
        private readonly appName: string,
        args: {
            readonly scope: pulumi.ComponentResource;
            readonly config: pulumi.Config;
            readonly namespace: string;
            readonly metadata: Metadata;
        },
    ) {
        super('orangelab:Storage', `${appName}-storage`, args, { parent: args.scope });
        this.config = args.config;
        this.namespace = args.namespace;
        this.metadata = args.metadata;
    }

    createVolumes(): kubernetes.types.input.core.v1.Volume[] {
        return Array.from(this.volumes.values());
    }

    addLocalVolume(volume: LocalVolume) {
        this.volumes.set(volume.name, {
            name: volume.name,
            hostPath: { path: volume.hostPath, type: volume.type },
        });
    }

    addPersistentVolume(volume?: PersistentVolume) {
        const volumeName = volume?.name ? `${this.appName}-${volume.name}` : this.appName;
        const prefix = volume?.name ? `${volume.name}/` : '';

        const storage = new LonghornVolume(
            `${volumeName}-storage`,
            {
                cloneFromClaim: volume?.cloneFromClaim,
                enableBackup: rootConfig.isBackupEnabled(this.appName, volume?.name),
                fromBackup: this.config.get(`${prefix}fromBackup`),
                fromVolume: volume?.fromVolume ?? this.config.get(`${prefix}fromVolume`),
                labels: volume?.name
                    ? this.metadata.getForComponent(volume.name).labels
                    : this.metadata.get().labels,
                name: volume?.overrideFullname ?? volumeName,
                namespace: this.namespace,
                size: volume?.size ?? this.config.require(`${prefix}storageSize`),
                storageClass: this.config.get(`${prefix}storageClass`),
                type: volume?.type ?? StorageType.Default,
            },
            { parent: this },
        );
        this.longhornVolumes.set(volumeName, storage);

        this.volumes.set(volumeName, {
            name: volumeName,
            persistentVolumeClaim: { claimName: storage.volumeClaimName },
        });
    }

    getClaimName(storageName?: string): string {
        const volumeName = storageName ? `${this.appName}-${storageName}` : this.appName;
        const storage = this.longhornVolumes.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.volumeClaimName;
    }

    getStorageClass(storageName?: string): pulumi.Output<string> {
        const volumeName = storageName ? `${this.appName}-${storageName}` : this.appName;
        const storage = this.longhornVolumes.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.storageClassName;
    }

    hasLocal(): boolean {
        return this.createVolumes().some(volume => volume.hostPath !== undefined);
    }

    hasVolumes(): boolean {
        return this.volumes.size > 0;
    }

    /**
     * Adds a config volume that contains multiple configuration files mounted in the same folder.
     * @param configVolume The config volume definition (name and files)
     */
    addConfigVolume(configVolume: ConfigVolume) {
        const volumeName = configVolume.name ?? 'config';
        const configMapName = `${this.appName}-${volumeName}`;
        new ConfigMap(
            configMapName,
            {
                metadata: {
                    name: configMapName,
                    namespace: this.namespace,
                    labels: this.metadata.get().labels,
                },
                data: configVolume.files,
            },
            { parent: this },
        );
        this.volumes.set(volumeName, {
            name: volumeName,
            configMap: { name: configMapName },
        });
    }

    /**
     * Determines if storage was provisioned dynamically or manually (clone, restore).
     *
     * @param storageName volume name or default when not specified
     * @returns True if storage was provisioned dynamically
     */
    isDynamic(storageName?: string): boolean {
        const volumeName = storageName ? `${this.appName}-${storageName}` : this.appName;
        const storage = this.longhornVolumes.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.isDynamic;
    }
}
