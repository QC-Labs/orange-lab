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
     * Enable automated backups for volume by adding it to "backup" group
     */
    enableBackup?: boolean;
    /**
     * Labels to apply to the PVC
     */
    labels?: Record<string, string>;
    /**
     * Annotations to apply to the PVC
     */
    annotations?: Record<string, string>;
    /**
     * Volume node affinity
     */
    affinity?: kubernetes.types.input.core.v1.VolumeNodeAffinity;
}

const staleReplicaTimeout = (48 * 60).toString();

export class LonghornVolume extends pulumi.ComponentResource {
    volumeClaimName: string;
    storageClassName: pulumi.Output<string>;
    isDynamic: boolean;
    size: pulumi.Output<string>;

    constructor(
        private name: string,
        private args: LonghornVolumeArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:LonghornVolume', name, args, opts);
        assert(
            !(args.storageClass && args.fromVolume),
            'Cannot specify fromVolume when using custom storageClass',
        );

        this.volumeClaimName = args.name;
        this.isDynamic = !args.fromVolume;
        if (args.fromVolume) {
            this.storageClassName = this.attachVolume();
        } else {
            this.storageClassName = this.createVolume();
        }
        this.size = pulumi.output(args.size);
    }

    private createVolume() {
        assert(!this.args.fromVolume);
        const pvc = this.createPVC({
            name: this.volumeClaimName,
            storageClassName:
                this.args.storageClass ?? rootConfig.getStorageClass(this.args.type),
        });
        return pvc.spec.storageClassName;
    }

    private attachVolume() {
        assert(this.args.fromVolume && !this.args.storageClass);
        const existingVolume = this.createLonghornPV({
            name: this.args.name,
            volumeHandle: this.args.fromVolume,
        });
        const pvc = this.createPVC({
            name: this.volumeClaimName,
            storageClassName: existingVolume.spec.storageClassName,
            volumeName: existingVolume.metadata.name,
        });
        return pvc.spec.storageClassName;
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
                    nodeAffinity: this.args.affinity,
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
        volumeName,
        storageClassName,
    }: {
        name: string;
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
                    annotations: this.args.annotations,
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName,
                    volumeName,
                    resources: { requests: { storage: this.args.size } },
                },
            },
            { parent: this },
        );
    }
}
