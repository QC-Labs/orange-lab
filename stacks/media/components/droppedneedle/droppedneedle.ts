import { Application, config, VolumeMount } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export class DroppedNeedle extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:DroppedNeedle', name, {}, opts);

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
        return this.app.addDeployment({
            ports: [{ name: 'http', port: 8688 }],
            volumeMounts: [
                { mountPath: '/app/config', subPath: 'config' },
                { mountPath: '/app/cache', subPath: 'cache' },
                { mountPath: '/media', name: 'media' },
            ],
            healthCheck: { httpGet: { path: '/health' } },
            env: {
                PUID: '1000',
                PGID: '1000',
                PORT: '8688',
                TZ: 'Etc/UTC',
                LOG_LEVEL: this.app.debug ? 'DEBUG' : undefined,
                SLSKD_DOWNLOADS_PATH: config.require(this.name, 'SLSKD_DOWNLOADS_PATH'),
            },
            resources: {
                requests: { memory: '128Mi' },
                limits: { memory: '512Mi' },
            },
        });
    }
}
