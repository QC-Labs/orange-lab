import { Application, config, VolumeMount } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export class Lidarr extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:Lidarr', name, {}, opts);

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

        this.app.addDeployment({
            ports: [{ name: 'http', port: 8686 }],
            volumeMounts,
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
