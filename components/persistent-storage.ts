import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from './root-config';

export enum PersistentStorageType {
    Default,
    GPU,
}

interface PersistentStorageArgs {
    name: string;
    namespace: pulumi.Input<string>;
    size: string;
    // determine storage class based on workload type
    type?: PersistentStorageType;
    // override storage class used
    storageClass?: string;
}

export class PersistentStorage extends pulumi.ComponentResource {
    volumeClaimName: string;

    constructor(
        name: string,
        args: PersistentStorageArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:PersistentStorage', name, args, opts);

        const storageClassName =
            args.storageClass ?? PersistentStorage.getStorageClass(args.type);

        new kubernetes.core.v1.PersistentVolumeClaim(
            `${name}-pvc`,
            {
                metadata: { name: args.name, namespace: args.namespace },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName,
                    resources: {
                        requests: {
                            storage: args.size,
                        },
                    },
                },
            },
            { parent: this },
        );
        this.volumeClaimName = args.name;
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
