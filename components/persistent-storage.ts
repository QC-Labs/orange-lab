import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from './root-config';
import { Longhorn } from './system/longhorn';

export enum PersistentStorageType {
    Default,
    GPU,
}

interface PersistentStorageArgs {
    name: string;
    namespace: pulumi.Input<string>;
    size: string;
    type?: PersistentStorageType;
}

export class PersistentStorage extends pulumi.ComponentResource {
    volumeClaimName: string;

    constructor(
        name: string,
        args: PersistentStorageArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:PersistentStorage', name, args, opts);

        const storageClassName = PersistentStorage.getStorageClass(args.type);

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
        let storageClassName = 'local-path';
        if (rootConfig.isEnabled('longhorn')) {
            switch (storageType) {
                case PersistentStorageType.GPU:
                    storageClassName = Longhorn.gpuStorageClass;
                    break;
                default:
                    storageClassName = Longhorn.defaultStorageClass;
            }
        }
        return storageClassName;
    }
}
