import * as kubernetes from '@pulumi/kubernetes';
import { ConfigMap, Secret } from '@pulumi/kubernetes/core/v1';
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
        return Array.from(this.localVolumes.values()).map(volume =>
            volume.getVolumeDefinition(),
        );
    }

    addLocalVolume(spec: LocalVolumeSpec) {
        const volume = new LocalVolume(
            `${this.appName}-storage-${spec.name}`,
            {
                appName: this.appName,
                volumeName: spec.name,
                localPath: spec.localPath,
                hostPath: spec.hostPath,
                size: spec.size,
                namespace: this.args.metadata.namespace,
                labels: this.args.metadata.get({ component: spec.name }).labels,
                affinity: this.args.nodes.getLocalVolumeAffinity(),
            },
            { parent: this },
        );
        this.localVolumes.set(spec.name, volume);
        this.volumes.set(spec.name, volume.getVolumeDefinition());
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
                affinity: this.args.nodes.getVolumeAffinity(volume?.name),
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
        return this.localVolumes.size > 0 || this.hasDeviceMounts();
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
     * Supports both regular files (ConfigMap) and secret files (Secret).
     * @param configVolume The config volume definition (name, files, and/or secretFiles)
     */
    addConfigVolume(configVolume: ConfigVolumeSpec) {
        if (this.configFilesHash) throw new Error('Only one ConfigVolumeSpec supported');

        if (!configVolume.files && !configVolume.secretFiles) {
            throw new Error('Either files or secretFiles must be provided');
        }

        this.configFilesHash = this.getConfigHash(configVolume);
        const volumeName = configVolume.name ?? 'config';

        if (configVolume.files) {
            this.addConfigMapVolume(volumeName, configVolume.files);
        }
        if (configVolume.secretFiles) {
            this.addSecretVolume(volumeName, configVolume.secretFiles);
        }
    }

    private addConfigMapVolume(name: string, files: Record<string, pulumi.Input<string>>) {
        new ConfigMap(
            `${this.appName}-${name}-cm`,
            {
                metadata: this.createMetadata(name),
                data: files,
            },
            { parent: this },
        );
        this.volumes.set(name, {
            name,
            configMap: { name },
        });
    }

    private addSecretVolume(name: string, files: Record<string, pulumi.Input<string>>) {
        const fullName = `${this.appName}-${name}`;
        new Secret(
            `${fullName}-secret`,
            {
                metadata: this.createMetadata(fullName),
                stringData: files,
            },
            { parent: this },
        );
        this.volumes.set(fullName, {
            name: fullName,
            secret: { secretName: fullName },
        });
    }

    private createMetadata(name: string) {
        return {
            name,
            namespace: this.args.metadata.namespace,
            labels: this.args.metadata.get().labels,
        };
    }

    /**
     * Adds a checksum/config annotation based on the given config volume's files.
     * This ensures deployments are restarted when config file contents change.
     */
    private getConfigHash(configVolume: ConfigVolumeSpec) {
        // Sort keys for deterministic hash - combine both files and secretFiles
        const allFiles: Record<string, pulumi.Input<string>> = {
            ...(configVolume.files ?? {}),
            ...(configVolume.secretFiles ?? {}),
        };
        const sortedFiles = Object.keys(allFiles)
            .sort()
            .map(k => ({ k, v: allFiles[k] }));
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
