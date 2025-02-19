import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Longhorn } from './longhorn';

/*
Disable debug first when switching volumes
debug:enabled true

Name of existing PVC (attached) or Longhorn volume name (detached)
debug:volumeName: cloned-volume

Use existing Longhorn volume instead of PVC.
debug:longhornVolume: true

Namespace volume was created in, defaults to volumeName
debug:namespace: default

Size has to match the volume
debug:storageSize: 10Gi

Deploy debug pod to specific node.
debug:nodeName: my-laptop

Local folder that will be mounted at /data-export
debug:exportPath: /home/user/orangelab-export
debug:exportPath: /run/media/user/usb-1/orangelab-export
*/
export class Debug extends pulumi.ComponentResource {
    namespace?: string;
    nodeName?: string;
    exportPath: string;
    storageSize: string;
    claim?: kubernetes.core.v1.PersistentVolumeClaim;

    constructor(private name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Debug', name, args, opts);

        const config = new pulumi.Config('debug');
        const volumeName = config.require('volumeName');
        this.namespace = config.get('namespace') ?? volumeName;
        const longhornVolume = config.getBoolean('longhornVolume');
        this.storageSize = config.require('storageSize');
        this.nodeName = config.get('nodeName');
        this.exportPath = config.require('exportPath');

        const volume = longhornVolume ? this.createPV(volumeName) : undefined;

        const claim = this.createPVC(volumeName, volume);

        // Comment out one method
        // this.createDeployment(volumeName, claim);
        // this.createExportJob(volumeName, claim);
    }

    private createPV(volumeName: string) {
        return new kubernetes.core.v1.PersistentVolume(
            `${this.name}-pv`,
            {
                metadata: {
                    name: `${this.name}-${volumeName}`,
                    namespace: this.namespace,
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName: Longhorn.defaultStorageClass,
                    capacity: { storage: this.storageSize },
                    volumeMode: 'Filesystem',
                    persistentVolumeReclaimPolicy: 'Retain',
                    csi: {
                        driver: 'driver.longhorn.io',
                        fsType: 'ext4',
                        volumeAttributes: {
                            numberOfReplicas: '1',
                            staleReplicaTimeout: '2880',
                        },
                        volumeHandle: volumeName,
                    },
                },
            },
            { parent: this },
        );
    }

    private createPVC(
        volumeName: string,
        existingVolume?: kubernetes.core.v1.PersistentVolume,
    ) {
        return new kubernetes.core.v1.PersistentVolumeClaim(
            `${this.name}-pvc`,
            {
                metadata: {
                    name: `${this.name}-${volumeName}`,
                    namespace: this.namespace,
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    dataSource: !existingVolume
                        ? { kind: 'PersistentVolumeClaim', name: volumeName }
                        : undefined,
                    volumeName: existingVolume?.metadata.name,
                    resources: { requests: { storage: this.storageSize } },
                },
            },
            { parent: this, deleteBeforeReplace: true },
        );
    }

    private createDeployment(
        volumeName: string,
        claim: kubernetes.core.v1.PersistentVolumeClaim,
    ) {
        const fullName = `${this.name}-${volumeName}`;
        new kubernetes.apps.v1.Deployment(
            `${this.name}-deployment`,
            {
                metadata: {
                    name: fullName,
                    namespace: this.namespace,
                },
                spec: {
                    selector: { matchLabels: { app: fullName } },
                    replicas: 1,
                    template: {
                        metadata: { name: fullName, labels: { app: fullName } },
                        spec: {
                            nodeName: this.nodeName,
                            containers: [
                                {
                                    args: ['sleep', '3600'],
                                    image: 'busybox',
                                    name: this.name,
                                    securityContext: { privileged: true },
                                    volumeMounts: [
                                        { name: 'source', mountPath: '/data' },
                                        { name: 'target', mountPath: '/data-export' },
                                    ],
                                },
                            ],
                            volumes: [
                                {
                                    name: 'source',
                                    persistentVolumeClaim: {
                                        claimName: claim.metadata.name,
                                    },
                                },
                                { name: 'target', hostPath: { path: this.exportPath } },
                            ],
                        },
                    },
                },
            },
            { parent: this, deleteBeforeReplace: true },
        );
    }
    private createExportJob(
        volumeName: string,
        claim: kubernetes.core.v1.PersistentVolumeClaim,
    ) {
        const fullName = `${this.name}-${volumeName}`;
        const labels = { app: fullName, component: 'export' };

        new kubernetes.batch.v1.Job(
            `${this.name}-export-job`,
            {
                metadata: {
                    name: fullName,
                    namespace: this.namespace,
                },
                spec: {
                    template: {
                        metadata: { name: fullName, labels },
                        spec: {
                            nodeName: this.nodeName,
                            containers: [
                                {
                                    args: [
                                        '/bin/sh',
                                        '-c',
                                        `tar zcvf /data-export/${volumeName}-$(date +"%Y%m%d").tgz /data/`,
                                    ],
                                    image: 'busybox',
                                    name: this.name,
                                    securityContext: { privileged: true },
                                    volumeMounts: [
                                        { name: 'source', mountPath: '/data' },
                                        { name: 'target', mountPath: '/data-export' },
                                    ],
                                },
                            ],
                            restartPolicy: 'Never',
                            volumes: [
                                {
                                    name: 'source',
                                    persistentVolumeClaim: {
                                        claimName: claim.metadata.name,
                                    },
                                },
                                { name: 'target', hostPath: { path: this.exportPath } },
                            ],
                        },
                    },
                },
            },
            { parent: this, deleteBeforeReplace: true },
        );
    }
}
