import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';

/*
Disable debug first when switching volumes
debug:enabled true

Namespace volume was created in
debug:namespace: app-namespace

Use existing Longhorn volume instead of PVC.
debug:fromVolume: restored-volume

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
    exportPath?: string;
    fromVolume?: string;

    constructor(
        private name: string,
        args = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Debug', name, args, opts);

        this.namespace = config.require(name, 'namespace');
        this.fromVolume = config.get(name, 'fromVolume');
        this.exportPath = config.get(name, 'exportPath');

        this.app = new Application(this, name, {
            existingNamespace: this.namespace,
        });
        if (this.fromVolume) {
            this.app.addStorage({ fromVolume: this.fromVolume });
        }
        if (this.exportPath) {
            this.app.addLocalStorage({ name: 'local', hostPath: this.exportPath });
        }

        // Comment out one method
        this.createDeployment();
        // this.createExportJob();
    }

    private createDeployment() {
        this.app.addDeployment({
            image: 'alpine',
            commandArgs: ['sleep', '3600'],
            volumeMounts: [
                this.fromVolume
                    ? { name: this.fromVolume, mountPath: '/data' }
                    : undefined,
                this.exportPath
                    ? { name: 'local', mountPath: '/data-export' }
                    : undefined,
            ].filter((vm): vm is NonNullable<typeof vm> => vm !== undefined),
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
