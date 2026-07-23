import { Application, config, InitContainerSpec, VolumeMount } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export class Transmission extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:Transmission', name, {}, opts);

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
            { mountPath: '/downloads', name: 'media', subPath: 'downloads' },
        ];

        const initVolumeContainer: InitContainerSpec = {
            name: 'init-downloads-dir',
            command: [
                'sh',
                '-c',
                'mkdir -p /media/downloads/complete /media/downloads/incomplete && chown -R 1000:1000 /media/downloads',
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
