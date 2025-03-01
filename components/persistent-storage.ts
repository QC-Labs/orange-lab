import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { rootConfig } from './root-config';

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
     * New volume won't be created.
     */
    existingVolume?: string;
    /**
     * Clone volume attached to existing claim. Used by Debug component to inspect already attached volumes
     */
    cloneExistingClaim?: string;
}

export class PersistentStorage extends pulumi.ComponentResource {
    volumeClaimName: string;

    constructor(
        private name: string,
        private args: PersistentStorageArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:PersistentStorage', name, args, opts);
        assert(
            !(args.cloneExistingClaim && args.existingVolume),
            'Cannot use both cloneExistingClaim and existingVolume',
        );
        assert(
            !(args.existingVolume && args.storageClass),
            'StorageClass cannot be changed when using existing Longhorn volumes',
        );

        const existingVolume = args.existingVolume
            ? this.createPV({ name: args.name, volumeHandle: args.existingVolume })
            : undefined;
        this.createPVC({
            name: args.name,
            existingVolume,
            cloneExistingClaim: args.cloneExistingClaim,
        });
        this.volumeClaimName = args.name;
    }

    private createPVC({
        name,
        existingVolume,
        cloneExistingClaim,
    }: {
        name: string;
        existingVolume?: kubernetes.core.v1.PersistentVolume;
        cloneExistingClaim?: string;
    }) {
        const storageClassName =
            this.args.storageClass ?? PersistentStorage.getStorageClass(this.args.type);
        new kubernetes.core.v1.PersistentVolumeClaim(
            `${this.name}-pvc`,
            {
                metadata: { name, namespace: this.args.namespace },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName: existingVolume
                        ? existingVolume.spec.storageClassName
                        : storageClassName,
                    dataSource: cloneExistingClaim
                        ? {
                              kind: 'PersistentVolumeClaim',
                              name: cloneExistingClaim,
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
