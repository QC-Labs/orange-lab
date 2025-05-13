import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { rootConfig } from './root-config';
import { StorageType } from './types';

interface LonghornVolumeArgs {
    name: string;
    namespace: pulumi.Output<string> | string;
    size: string;
    /**
     * Determine storage class based on workload type
     */
    type?: StorageType;
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

const staleReplicaTimeout = (48 * 60).toString();

export class LonghornVolume extends pulumi.ComponentResource {
    volumeClaimName: string;
    storageClassName: pulumi.Output<string>;
    isDynamic: boolean;

    constructor(
        private name: string,
        private args: LonghornVolumeArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:LonghornVolume', name, args, opts);
        assert(
            !(args.cloneFromClaim && args.fromVolume),
            'Cannot use both cloneFromClaim and fromVolume',
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

        this.volumeClaimName = args.name;
        this.isDynamic = !args.fromVolume;
        if (args.fromVolume) {
            this.storageClassName = this.attachVolume(args);
        } else {
            this.storageClassName = this.createVolume(args);
        }
    }

    private createVolume(args: LonghornVolumeArgs) {
        assert(!args.fromVolume);
        const storageClassName =
            this.args.storageClass ?? this.createLonghornStorageClass();
        const pvc = this.createPVC({
            name: this.volumeClaimName,
            cloneFromClaim: args.cloneFromClaim,
            storageClassName,
        });
        return pvc.spec.storageClassName;
    }

    private attachVolume(args: LonghornVolumeArgs) {
        assert(args.fromVolume && !args.storageClass);
        const existingVolume = this.createLonghornPV({
            name: args.name,
            volumeHandle: args.fromVolume,
        });
        const pvc = this.createPVC({
            name: this.volumeClaimName,
            storageClassName: existingVolume.spec.storageClassName,
            volumeName: existingVolume.metadata.name,
        });
        return pvc.spec.storageClassName;
    }

    private createLonghornStorageClass(): pulumi.Output<string> {
        const isLocalOnly = this.args.type === StorageType.GPU;
        const isDefault = this.args.type === StorageType.Default;
        const storageClass = new kubernetes.storage.v1.StorageClass(
            `${this.name}-sc`,
            {
                metadata: {
                    name: `longhorn-${this.args.name}`,
                    namespace: 'longhorn-system',
                },
                provisioner: 'driver.longhorn.io',
                allowVolumeExpansion: true,
                parameters: {
                    numberOfReplicas: isDefault
                        ? rootConfig.longhorn.replicaCount.toString()
                        : '1',
                    dataLocality: isLocalOnly ? 'strict-local' : 'best-effort',
                    ...(this.args.fromBackup && { fromBackup: this.args.fromBackup }),
                    staleReplicaTimeout: isDefault ? '30' : staleReplicaTimeout,
                },
                volumeBindingMode: isLocalOnly ? 'WaitForFirstConsumer' : 'Immediate',
            },
            { parent: this },
        );
        return storageClass.metadata.name;
    }

    private createLonghornPV({
        name,
        volumeHandle,
    }: {
        name: string;
        volumeHandle: string;
    }) {
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
                            staleReplicaTimeout,
                        },
                        volumeHandle,
                    },
                },
            },
            { parent: this },
        );
    }

    private createPVC({
        name,
        cloneFromClaim,
        volumeName,
        storageClassName,
    }: {
        name: string;
        cloneFromClaim?: string;
        volumeName?: pulumi.Output<string>;
        storageClassName: pulumi.Output<string> | string;
    }) {
        const labels = { ...(this.args.labels ?? {}) };

        labels['recurring-job.longhorn.io/source'] = 'enabled';
        labels['recurring-job-group.longhorn.io/default'] = 'enabled';

        if (this.args.enableBackup) {
            labels['recurring-job-group.longhorn.io/backup'] = 'enabled';
        }

        return new kubernetes.core.v1.PersistentVolumeClaim(
            `${this.name}-pvc`,
            {
                metadata: {
                    name,
                    namespace: this.args.namespace,
                    labels,
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName,
                    dataSource: cloneFromClaim
                        ? {
                              kind: 'PersistentVolumeClaim',
                              name: cloneFromClaim,
                          }
                        : undefined,
                    volumeName,
                    resources: { requests: { storage: this.args.size } },
                },
            },
            { parent: this },
        );
    }
}
