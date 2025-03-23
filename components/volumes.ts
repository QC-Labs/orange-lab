import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { PersistentStorage, PersistentStorageType } from './persistent-storage';

export interface LocalVolume {
    name: string;
    hostPath: string;
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

    constructor(
        private readonly appName: string,
        args: {
            readonly scope: pulumi.ComponentResource;
            readonly config: pulumi.Config;
            readonly namespace: string;
        },
    ) {
        this.config = args.config;
        this.namespace = args.namespace;
        this.scope = args.scope;
    }

    create(): kubernetes.types.input.core.v1.Volume[] {
        return Array.from(this.volumes.values());
    }

    addLocalVolume(volume: LocalVolume) {
        this.volumes.set(volume.name, {
            name: volume.name,
            hostPath: { path: volume.hostPath },
        });
    }

    addPersistentVolume(volume?: PersistentVolume) {
        const volumeName = volume?.name ? `${this.appName}-${volume.name}` : this.appName;
        const fromVolume = volume?.fromVolume ?? this.config.get('fromVolume');
        const storage = new PersistentStorage(
            `${volumeName}-storage`,
            {
                name: volumeName,
                namespace: this.namespace,
                size: volume?.size ?? this.config.require('storageSize'),
                type: volume?.type ?? PersistentStorageType.Default,
                storageClass: this.config.get('storageClass'),
                fromVolume,
                cloneFromClaim: volume?.cloneFromClaim,
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

    hasLocal(): boolean {
        return this.create().some(volume => volume.hostPath !== undefined);
    }

    hasVolumes(): boolean {
        return this.volumes.size > 0;
    }
}
