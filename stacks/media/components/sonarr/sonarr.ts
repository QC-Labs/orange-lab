import { Application, config, VolumeMount } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export class Sonarr extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:Sonarr', name, {}, opts);

        this.app = new Application(this, name).addStorage().addLocalStorage({
            name: 'media',
            hostPath: config.require(this.name, 'media/hostPath'),
        });

        this.createDeployment();
    }

    private createDeployment() {
        const volumeMounts: VolumeMount[] = [
            { mountPath: '/config' },
            { mountPath: '/media', name: 'media' },
        ];

        this.app.addDeployment({
            ports: [{ name: 'http', port: 8989 }],
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
