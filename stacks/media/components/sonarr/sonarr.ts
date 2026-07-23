import { Application, config, InitContainerSpec, VolumeMount } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export class Sonarr extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:Sonarr', name, {}, opts);

        const mediaFromVolume = config.get(this.name, 'media/fromVolume');

        this.app = new Application(this, name).addStorage();

        if (mediaFromVolume) {
            this.app.addStorage({
                name: 'media',
                fromVolume: mediaFromVolume,
                accessMode: 'ReadWriteMany',
            });
        } else {
            this.app.addLocalStorage({
                name: 'media',
                hostPath: config.require(this.name, 'media/hostPath'),
            });
        }

        this.createDeployment();
    }

    private createDeployment() {
        const volumeMounts: VolumeMount[] = [
            { mountPath: '/config' },
            { mountPath: '/media', name: 'media' },
        ];

        const initDownloadsDir: InitContainerSpec = {
            name: 'init-downloads-dir',
            command: [
                'sh',
                '-c',
                'mkdir -p /media/downloads/complete/tv-sonarr && chown -R 1000:1000 /media/downloads/complete/tv-sonarr',
            ],
            volumeMounts,
        };

        this.app.addDeployment({
            ports: [{ name: 'http', port: 8989 }],
            volumeMounts,
            initContainers: [initDownloadsDir],
            env: {
                PUID: '1000',
                PGID: '1000',
            },
            resources: {
                requests: { memory: '128Mi' },
                limits: { memory: '512Mi' },
            },
        });
    }
}
