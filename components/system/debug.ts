import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Application } from '../application';

/*
Disable debug first when switching volumes
debug:enabled true

Namespace volume was created in, defaults to clonePvc
debug:namespace: default

Name of existing attached PVC, the related volume will be cloned
debug:clonePvc: beszel

Use existing Longhorn volume instead of PVC.
debug:existingVolume: cloned-volume

Size has to match the volume
debug:storageSize: 10Gi

Deploy debug pod to specific node.
debug:requiredNodeLabel: kubernetes.io/hostname=my-laptop

Local folder that will be mounted at /data-export
debug:exportPath: /home/user/orangelab-export
debug:exportPath: /run/media/user/usb-1/orangelab-export
*/
export class Debug extends pulumi.ComponentResource {
    app: Application;
    namespace: string;
    exportPath: string;

    constructor(private name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Debug', name, args, opts);

        const config = new pulumi.Config('debug');
        const clonePvc = config.get('clonePvc');
        const existingVolume = config.get('existingVolume');
        this.namespace = config.get('namespace') ?? clonePvc ?? 'default';
        this.exportPath = config.require('exportPath');

        const volumeName = clonePvc ?? existingVolume;
        assert(volumeName, 'Either clonePvc or existingVolume must be provided');
        this.app = new Application(this, name, {
            existingNamespace: this.namespace,
        })
            .addLocalStorage({ name: 'local', hostPath: this.exportPath })
            .addStorage({
                existingVolume,
                cloneExistingClaim: clonePvc,
            });

        // Comment out one method
        // this.createDeployment();
        // this.createExportJob();
    }

    private createDeployment() {
        this.app.addDeployment({
            image: 'alpine',
            commandArgs: ['sleep', '3600'],
            volumeMounts: [
                { mountPath: '/data' },
                { name: 'local', mountPath: '/data-export' },
            ],
        });
    }

    private createExportJob() {
        this.app.addJob({
            name: 'export',
            image: 'busybox',
            commandArgs: [
                'sh',
                '-c',
                `tar zcvf /data-export/${this.namespace}-$(date +"%Y%m%d").tgz /data/`,
            ],
            volumeMounts: [
                { mountPath: '/data' },
                { name: 'local', mountPath: '/data-export' },
            ],
            restartPolicy: 'Never',
        });
    }
}
