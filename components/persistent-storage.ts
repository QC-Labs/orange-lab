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

        let storageClassName = 'local-path';
        if (rootConfig.isEnabled('longhorn')) {
            switch (args.type) {
                case PersistentStorageType.GPU:
                    storageClassName = Longhorn.gpuStorageClass;
                    break;
                default:
                    storageClassName = Longhorn.defaultStorageClass;
            }
        }

        new kubernetes.core.v1.PersistentVolumeClaim(
            'pvc',
            {
                metadata: { name, namespace: args.namespace },
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
        this.volumeClaimName = name;
    }
}
