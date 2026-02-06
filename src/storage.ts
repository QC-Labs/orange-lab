import * as kubernetes from '@pulumi/kubernetes';
import { ConfigMap } from '@pulumi/kubernetes/core/v1';
import * as pulumi from '@pulumi/pulumi';
import * as crypto from 'crypto';
import assert from 'node:assert';
import { config } from './config';
import { LocalVolume } from './local-volume';
import { LonghornVolume } from './longhorn-volume';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import {
    ConfigVolumeSpec,
    DeviceMountSpec,
    LocalVolumeSpec,
    PersistentVolumeSpec,
} from './types';

export class Storage extends pulumi.ComponentResource {
    private localVolumes = new Map<string, LocalVolume>();
    private longhornVolumes = new Map<string, LonghornVolume>();
    private volumes = new Map<string, kubernetes.types.input.core.v1.Volume>();
    private deviceMounts = new Map<string, DeviceMountSpec>();
    public configFilesHash?: pulumi.Output<string>;

    constructor(
        private appName: string,
        private args: {
            metadata: Metadata;
            nodes: Nodes;
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:Storage', `${appName}-storage`, args, opts);
    }

    getVolumes(): kubernetes.types.input.core.v1.Volume[] {
        return Array.from(this.volumes.values());
    }

    getLocalVolumes(): kubernetes.types.input.core.v1.Volume[] {
        return this.getVolumes().filter(v => v.hostPath !== undefined);
    }

    addLocalVolume(spec: LocalVolumeSpec) {
        const fullName = `${this.appName}-${spec.name}`;
        const volume = new LocalVolume(
            `${fullName}-storage`,
            {
                name: fullName,
                hostPath: spec.hostPath,
                size: spec.size,
                namespace: this.args.metadata.namespace,
                labels: this.args.metadata.get({ component: spec.name }).labels,
                affinity: this.args.nodes.getLocalVolumeAffinity(),
            },
            { parent: this },
        );
        this.localVolumes.set(spec.name, volume);
        this.volumes.set(spec.name, {
            name: spec.name,
            persistentVolumeClaim: { claimName: volume.volumeClaimName },
        });
    }

    addDeviceMount(volume: DeviceMountSpec) {
        const volumeName = volume.name;
        this.deviceMounts.set(volumeName, volume);
        this.volumes.set(volumeName, {
            name: volumeName,
            hostPath: { path: volume.hostPath, type: volume.type ?? 'CharDevice' },
        });
    }

    addPersistentVolume(volume?: PersistentVolumeSpec) {
        const volumeName = this.getVolumeName(volume?.name);
        const prefix = volume?.name ? `${volume.name}/` : '';
        const labels = volume?.name
            ? this.args.metadata.get({ component: volume.name }).labels
            : this.args.metadata.get().labels;
        const storage = new LonghornVolume(
            `${volumeName}-storage`,
            {
                affinity: this.args.nodes.getVolumeAffinity(),
                annotations: volume?.annotations,
                enableBackup: config.isBackupEnabled(this.appName, volume?.name),
                fromVolume:
                    volume?.fromVolume ?? config.get(this.appName, `${prefix}fromVolume`),
                labels: { ...labels, ...volume?.labels },
                name: volume?.overrideFullname ?? volumeName,
                namespace: this.args.metadata.namespace,
                size:
                    volume?.size ?? config.require(this.appName, `${prefix}storageSize`),
                storageClass: config.get(this.appName, `${prefix}storageClass`),
                type: volume?.type,
            },
            { parent: this },
        );
        this.longhornVolumes.set(volumeName, storage);
        this.volumes.set(volumeName, {
            name: volumeName,
            persistentVolumeClaim: { claimName: storage.volumeClaimName },
        });
    }

    getClaimName(storageName?: string): pulumi.Output<string> {
        const volumeName = this.getVolumeName(storageName);
        const storage = this.longhornVolumes.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.volumeClaimName;
    }

    getStorageClass(storageName?: string): pulumi.Output<string> {
        const volumeName = this.getVolumeName(storageName);
        const storage = this.longhornVolumes.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.storageClassName;
    }

    getStorageSize(storageName?: string): pulumi.Output<string> {
        const volumeName = this.getVolumeName(storageName);
        const storage = this.longhornVolumes.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.size;
    }

    hasLocal(): boolean {
        return (
            this.getVolumes().some(volume => volume.hostPath !== undefined) ||
            this.hasDeviceMounts()
        );
    }

    hasDeviceMounts(): boolean {
        return this.deviceMounts.size > 0;
    }

    hasVolumes(): boolean {
        return this.volumes.size > 0;
    }

    private getVolumeName(storageName?: string): string {
        return storageName ? `${this.appName}-${storageName}` : this.appName;
    }

    /**
     * Adds a config volume that contains multiple configuration files mounted in the same folder.
     * @param configVolume The config volume definition (name and files)
     */
    addConfigVolume(configVolume: ConfigVolumeSpec) {
        if (this.configFilesHash) throw new Error('Only one ConfigVolumeSpec supported');
        this.configFilesHash = this.getConfigHash(configVolume);
        const volumeName = configVolume.name ?? 'config';
        new ConfigMap(
            `${this.appName}-${volumeName}-cm`,
            {
                metadata: {
                    name: volumeName,
                    namespace: this.args.metadata.namespace,
                    labels: this.args.metadata.get().labels,
                },
                data: configVolume.files,
            },
            { parent: this },
        );
        this.volumes.set(volumeName, {
            name: volumeName,
            configMap: { name: volumeName },
        });
    }

    /**
     * Adds a checksum/config annotation based on the given config volume's files.
     * This ensures deployments are restarted when config file contents change.
     */
    private getConfigHash(configVolume: ConfigVolumeSpec) {
        // Sort keys for deterministic hash
        const sortedFiles = Object.keys(configVolume.files)
            .sort()
            .map(k => ({ k, v: configVolume.files[k] }));
        return pulumi.jsonStringify(sortedFiles).apply(str => {
            const hash = crypto.createHash('sha256').update(str).digest('hex');
            return hash;
        });
    }

    /**
     * Determines if storage was provisioned dynamically or manually (clone, restore).
     *
     * @param storageName volume name or default when not specified
     * @returns True if storage was provisioned dynamically
     */
    isDynamic(storageName?: string): boolean {
        const volumeName = this.getVolumeName(storageName);
        const storage = this.longhornVolumes.get(volumeName);
        assert(storage, `Storage ${volumeName} not found`);
        return storage.isDynamic;
    }
}
