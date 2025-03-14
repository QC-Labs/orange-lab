import * as kubernetes from '@pulumi/kubernetes';
import { PersistentStorage, PersistentStorageType } from './persistent-storage';
import * as pulumi from '@pulumi/pulumi';

export interface LocalVolume {
    name: string;
    hostPath: string;
}

export interface PersistentVolume {
    size?: string;
    type?: PersistentStorageType;
    existingVolume?: string;
    cloneExistingClaim?: string;
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
        const storage = new PersistentStorage(
            `${this.appName}-storage`,
            {
                name: this.appName,
                namespace: this.namespace,
                size: volume?.size ?? this.config.require('storageSize'),
                type: volume?.type ?? PersistentStorageType.Default,
                storageClass: this.config.get('storageClass'),
                existingVolume: volume?.existingVolume,
                cloneExistingClaim: volume?.cloneExistingClaim,
            },
            { parent: this.scope },
        );
        this.persistentStorage.set(this.appName, storage);
        this.volumes.set(this.appName, {
            name: this.appName,
            persistentVolumeClaim: { claimName: storage.volumeClaimName },
        });
    }

    getClaimName(storageName?: string) {
        return this.persistentStorage.get(storageName ?? this.appName)?.volumeClaimName;
    }

    hasLocal(): boolean {
        return this.create().some(volume => volume.hostPath !== undefined);
    }

    hasVolumes(): boolean {
        return this.volumes.size > 0;
    }
}
