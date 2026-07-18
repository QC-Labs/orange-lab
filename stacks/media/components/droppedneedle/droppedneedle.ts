import { Application, config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export class DroppedNeedle extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:DroppedNeedle', name, {}, opts);

        const mediaHostPath = config.require(this.name, 'media/hostPath');

        this.app = new Application(this, name).addStorage().addLocalStorage({
            name: 'media',
            hostPath: mediaHostPath,
        });

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
