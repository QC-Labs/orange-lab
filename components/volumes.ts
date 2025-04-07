import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Metadata } from './metadata';
import { PersistentStorage, PersistentStorageType } from './persistent-storage';

export interface LocalVolume {
    name: string;
    hostPath: string;
    type?: 'Directory' | 'DirectoryOrCreate' | 'FileOrCreate' | 'CharDevice';
}

export interface PersistentVolume {
    name?: string;
    size?: string;
    type?: PersistentStorageType;
    fromVolume?: string;
    cloneFromClaim?: string;
}

export class Volumes {
    private readonly persistentStorage = new Map<string, PersistentStorage>();
    private readonly volumes = new Map<string, kubernetes.types.input.core.v1.Volume>();
    private readonly config: pulumi.Config;
    private readonly namespace: string;
    private readonly scope: pulumi.ComponentResource;
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
        this.config = args.config;
        this.namespace = args.namespace;
        this.scope = args.scope;
        this.metadata = args.metadata;
    }

    create(): kubernetes.types.input.core.v1.Volume[] {
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

        const storage = new PersistentStorage(
            `${volumeName}-storage`,
            {
                cloneFromClaim: volume?.cloneFromClaim,
                enableBackup: this.config.getBoolean(`${prefix}backupVolume`),
                fromBackup: this.config.get(`${prefix}fromBackup`),
                fromVolume: volume?.fromVolume ?? this.config.get(`${prefix}fromVolume`),
                labels: volume?.name
                    ? this.metadata.getForComponent(volume.name).labels
                    : this.metadata.get().labels,
                name: volumeName,
                namespace: this.namespace,
                size: volume?.size ?? this.config.require(`${prefix}storageSize`),
                storageClass: this.config.get(`${prefix}storageClass`),
                type: volume?.type ?? PersistentStorageType.Default,
            },
            { parent: this.scope },
        );
        this.persistentStorage.set(volumeName, storage);

        this.volumes.set(volumeName, {
            name: volumeName,
            persistentVolumeClaim: { claimName: storage.volumeClaimName },
        });
    }

    getClaimName(storageName?: string): string {
        const volumeName = storageName ? `${this.appName}-${storageName}` : this.appName;
        const storage = this.persistentStorage.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.volumeClaimName;
    }

    getStorageClass(storageName?: string): pulumi.Output<string> {
        const volumeName = storageName ? `${this.appName}-${storageName}` : this.appName;
        const storage = this.persistentStorage.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.storageClassName;
    }

    hasLocal(): boolean {
        return this.create().some(volume => volume.hostPath !== undefined);
    }

    hasVolumes(): boolean {
        return this.volumes.size > 0;
    }
}
