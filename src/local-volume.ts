import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

interface LocalVolumeArgs {
    name: string;
    hostPath: string;
    size: string;
    namespace: pulumi.Input<string>;
    labels: Record<string, string>;
    affinity?: kubernetes.types.input.core.v1.VolumeNodeAffinity;
}

export class LocalVolume extends pulumi.ComponentResource {
    volumeClaimName: pulumi.Output<string>;

    constructor(
        private name: string,
        private args: LocalVolumeArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:LocalVolume', name, args, opts);

        const storageClass = this.createStorageClass();
        const pv = this.createPersistentVolume(storageClass);
        const pvc = this.createPersistentVolumeClaim(storageClass, pv);

        this.volumeClaimName = pvc.metadata.name;
    }

    private createPersistentVolume(
        storageClass: kubernetes.storage.v1.StorageClass,
    ): kubernetes.core.v1.PersistentVolume {
        return new kubernetes.core.v1.PersistentVolume(
            `${this.name}-pv`,
            {
                metadata: { name: this.args.name, labels: this.args.labels },
                spec: {
                    capacity: { storage: this.args.size },
                    accessModes: ['ReadWriteOnce'],
                    persistentVolumeReclaimPolicy: 'Retain',
                    storageClassName: storageClass.metadata.name,
                    local: { path: this.args.hostPath },
                    nodeAffinity: this.args.affinity,
                },
            },
            { parent: this },
        );
    }

    private createPersistentVolumeClaim(
        storageClass: kubernetes.storage.v1.StorageClass,
        pv: kubernetes.core.v1.PersistentVolume,
    ): kubernetes.core.v1.PersistentVolumeClaim {
        return new kubernetes.core.v1.PersistentVolumeClaim(
            `${this.name}-pvc`,
            {
                metadata: {
                    name: this.args.name,
                    namespace: this.args.namespace,
                    labels: this.args.labels,
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName: storageClass.metadata.name,
                    volumeName: pv.metadata.name,
                    resources: { requests: { storage: this.args.size } },
                },
            },
            { parent: this },
        );
    }

    private createStorageClass(): kubernetes.storage.v1.StorageClass {
        return new kubernetes.storage.v1.StorageClass(
            `${this.name}-sc`,
            {
                metadata: { name: `${this.args.name}-sc` },
                provisioner: 'kubernetes.io/no-provisioner',
                volumeBindingMode: 'WaitForFirstConsumer',
                reclaimPolicy: 'Retain',
            },
            { parent: this },
        );
    }
}
