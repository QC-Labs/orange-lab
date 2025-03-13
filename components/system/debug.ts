import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Application } from '../application';

/*
Disable debug first when switching volumes
debug:enabled true

Name of existing attached PVC, the related volume will be cloned
debug:clonePvc: beszel

Use existing Longhorn volume instead of PVC.
debug:existingVolume: cloned-volume

Namespace volume was created in, defaults to clonePvc
debug:namespace: default

Size has to match the volume
debug:storageSize: 10Gi

Deploy debug pod to specific node.
debug:requiredNodeLabel: kubernetes.io/hostname=my-laptop

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
    app: Application;

    constructor(private name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Debug', name, args, opts);

        const config = new pulumi.Config('debug');
        const clonePvc = config.get('clonePvc');
        const existingVolume = config.get('existingVolume');
        this.namespace = config.get('namespace') ?? clonePvc;
        this.storageSize = config.require('storageSize');
        this.nodeName = config.get('nodeName');
        this.exportPath = config.require('exportPath');

        const volumeName = clonePvc ?? existingVolume;
        assert(volumeName, 'Either clonePvc or existingVolume must be provided');
        this.app = new Application(this, name, {
            existingNamespace: this.namespace,
        })
            .addStorage({
                size: this.storageSize,
                existingVolume,
                cloneExistingClaim: clonePvc,
            })
            .addLocalStorage(this.exportPath);
        assert(this.app.storage?.volumeClaimName);

        // Comment out one method
        this.createDeployment();
        // this.createExportJob(volumeName, this.app.storage.volumeClaimName);
    }

    private createDeployment() {
        this.app.addDeployment({
            image: 'alpine',
            commandArgs: ['sleep', '3600'],
            volumeMounts: [{ mountPath: '/data' }],
            localVolumeMountPath: '/export',
        });
    }

    private createExportJob(volumeName: string, claimName: string) {
        new kubernetes.batch.v1.Job(
            `${this.name}-export-job`,
            {
                metadata: {
                    name: this.name,
                    namespace: this.namespace,
                },
                spec: {
                    template: {
                        metadata: {
                            name: this.name,
                            labels: { app: this.name, component: 'export' },
                        },
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
                                { name: 'source', persistentVolumeClaim: { claimName } },
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
