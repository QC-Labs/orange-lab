import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import { InitContainerSpec, VolumeMount } from '@orangelab/types';
import * as pulumi from '@pulumi/pulumi';

export class Transmission extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:Transmission', name, {}, opts);

        this.app = new Application(this, name).addStorage().addLocalStorage({
            name: 'media',
            hostPath: config.require(this.name, 'media/hostPath'),
        });

        this.createDeployment();
    }

    private createDeployment() {
        const volumeMounts: VolumeMount[] = [
            { mountPath: '/config' },
            { mountPath: '/downloads', name: 'media', subPath: 'downloads' },
        ];

        const initVolumeContainer: InitContainerSpec = {
            name: 'init-downloads-dir',
            command: [
                'sh',
                '-c',
                'mkdir -p /media/downloads && chown -R 1000:1000 /media/downloads',
            ],
            volumeMounts: [{ mountPath: '/media', name: 'media' }],
        };

        this.app.addDeployment({
            ports: [
                { name: 'http', port: 9091 },
                { name: 'p2p-tcp', port: 51413, protocol: 'tcp' },
                { name: 'p2p-udp', port: 51413, protocol: 'udp' },
            ],
            volumeMounts,
            env: {
                PUID: '1000',
                PGID: '1000',
            },
            initContainers: [initVolumeContainer],
            resources: {
                requests: { memory: '64Mi' },
                limits: { memory: '256Mi' },
            },
        });
    }
}
