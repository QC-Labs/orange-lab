import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { rootConfig } from './root-config';
import { Longhorn } from './system/longhorn';

export enum PersistentStorageType {
    Default,
    GPU,
}

interface PersistentStorageArgs {
    name: string;
    namespace: pulumi.Output<string> | string;
    size: string;
    /**
     * Determine storage class based on workload type
     */
    type?: PersistentStorageType;
    /**
     * Override storage class used
     */
    storageClass?: string;
    /**
     * Name of currently detached Longhorn volume.
     * Use with volumes restored from backup. New volume won't be created.
     */
    fromVolume?: string;
    /**
     * Clone volume attached to existing claim.
     * Used by Debug component to inspect contents of already attached volumes
     */
    cloneFromClaim?: string;
    /**
     * Enable automated backups for volume by adding it to "backup" group
     */
    enableBackup?: boolean;
    /**
     * Location of the backup volume
     */
    fromBackup?: string;
    /**
     * Labels to apply to the volume
     */
    labels?: Record<string, string>;
}

export class PersistentStorage extends pulumi.ComponentResource {
    volumeClaimName: string;
    storageClassName: pulumi.Output<string>;

    constructor(
        private name: string,
        private args: PersistentStorageArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:PersistentStorage', name, args, opts);
        assert(
            !(args.cloneFromClaim && args.fromVolume),
            'Cannot use both cloneFromClaim and fromVolume',
        );
        assert(
            !(args.fromVolume && args.storageClass),
            'StorageClass cannot be changed when using existing Longhorn volumes',
        );
        assert(
            !(args.fromVolume && args.fromBackup),
            'Either use fromVolume or fromBackup',
        );
        assert(
            !(
                args.storageClass &&
                (args.fromVolume ?? args.fromBackup ?? args.cloneFromClaim)
            ),
            'Cannot specify fromVolume, cloneFromClaim, fromBackup when using custom storageClass',
        );

        let backupStorageClass;
        if (args.fromBackup) {
            backupStorageClass = this.createBackupStorageClass();
        }

        const existingVolume = args.fromVolume
            ? this.createPV({
                  name: args.name,
                  volumeHandle: args.fromVolume,
              })
            : undefined;

        this.storageClassName = pulumi
            .output(
                existingVolume?.spec.storageClassName ??
                    backupStorageClass ??
                    args.storageClass ??
                    PersistentStorage.getStorageClass(this.args.type) ??
                    Longhorn.defaultStorageClass,
            )
            .apply(sc => sc);

        this.createPVC({
            name: args.name,
            existingVolume,
            cloneFromClaim: args.cloneFromClaim,
        });
        this.volumeClaimName = args.name;
    }

    private createBackupStorageClass(): pulumi.Output<string> {
        const restored = new kubernetes.storage.v1.StorageClass(`${this.name}-sc`, {
            metadata: {
                name: `longhorn-${this.args.name}`,
                namespace: 'longhorn-system',
            },
            provisioner: 'driver.longhorn.io',
            allowVolumeExpansion: true,
            parameters: {
                numberOfReplicas: '1',
                ...(this.args.fromBackup && { fromBackup: this.args.fromBackup }),
            },
            volumeBindingMode: 'WaitForFirstConsumer',
        });

        return restored.metadata.name;
    }

    private createPVC({
        name,
        existingVolume,
        cloneFromClaim,
    }: {
        name: string;
        existingVolume?: kubernetes.core.v1.PersistentVolume;
        cloneFromClaim?: string;
    }) {
        const labels = { ...(this.args.labels ?? {}) };

        if (this.args.enableBackup) {
            labels['recurring-job.longhorn.io/source'] = 'enabled';
            labels['recurring-job-group.longhorn.io/default'] = 'enabled';
            labels['recurring-job-group.longhorn.io/backup'] = 'enabled';
        }

        new kubernetes.core.v1.PersistentVolumeClaim(
            `${this.name}-pvc`,
            {
                metadata: {
                    name,
                    namespace: this.args.namespace,
                    labels,
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName: this.storageClassName,
                    dataSource: cloneFromClaim
                        ? {
                              kind: 'PersistentVolumeClaim',
                              name: cloneFromClaim,
                          }
                        : undefined,
                    volumeName: existingVolume?.metadata.name,
                    resources: { requests: { storage: this.args.size } },
                },
            },
            { parent: this },
        );
    }

    private createPV({ name, volumeHandle }: { name: string; volumeHandle: string }) {
        return new kubernetes.core.v1.PersistentVolume(
            `${this.name}-pv`,
            {
                metadata: {
                    name,
                    namespace: this.args.namespace,
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName: `longhorn-${volumeHandle}`,
                    capacity: { storage: this.args.size },
                    volumeMode: 'Filesystem',
                    persistentVolumeReclaimPolicy: 'Retain',
                    csi: {
                        driver: 'driver.longhorn.io',
                        fsType: 'ext4',
                        volumeAttributes: {
                            numberOfReplicas: '1',
                            staleReplicaTimeout: '2880',
                        },
                        volumeHandle,
                    },
                },
            },
            { parent: this },
        );
    }

    public static getStorageClass(storageType?: PersistentStorageType) {
        switch (storageType) {
            case PersistentStorageType.GPU:
                return rootConfig.get('storageClass-gpu');
            default:
                return rootConfig.get('storageClass');
        }
    }
}
