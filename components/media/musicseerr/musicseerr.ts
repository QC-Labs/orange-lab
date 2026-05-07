import { Application } from '@orangelab/application';
import * as pulumi from '@pulumi/pulumi';

export class MusicSeerr extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:MusicSeerr', name, {}, opts);

        this.app = new Application(this, name).addStorage();

        this.createDeployment();
    }

    private createDeployment() {
        return this.app.addDeployment({
            ports: [{ name: 'http', port: 8688 }],
            volumeMounts: [
                { mountPath: '/app/config' },
                { mountPath: '/app/cache', subPath: 'cache' },
            ],
            env: {
                PUID: '1000',
                PGID: '1000',
                PORT: '8688',
            },
            resources: {
                requests: { memory: '128Mi' },
                limits: { memory: '512Mi' },
            },
        });
    }
}
