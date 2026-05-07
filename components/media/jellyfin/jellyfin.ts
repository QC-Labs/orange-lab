import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import { VolumeMount } from '@orangelab/types';
import * as pulumi from '@pulumi/pulumi';

export class Jellyfin extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:Jellyfin', name, {}, opts);

        this.app = new Application(this, name).addStorage().addLocalStorage({
            name: 'media',
            hostPath: config.require(this.name, 'media/hostPath'),
        });

        this.createDeployment();
    }

    private createDeployment() {
        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();
        const volumeMounts: VolumeMount[] = [
            { mountPath: '/data' },
            { mountPath: '/media', name: 'media' },
        ];

        return this.app.addDeployment({
            hostname: httpEndpointInfo.host,
            ports: [
                { name: 'http', port: 8096 },
                { name: 'udp', port: 7359, protocol: 'udp' },
                { name: 'dnla', port: 1900, protocol: 'udp' },
            ],
            volumeMounts,
            env: {
                PUID: '1000',
                PGID: '1000',
                JELLYFIN_DATA_DIR: '/data',
                JELLYFIN_CONFIG_DIR: '/data/config',
                JELLYFIN_CACHE_DIR: '/data/cache',
                JELLYFIN_LOG_DIR: '/data/log',
                JELLYFIN_PublishedServerUrl: httpEndpointInfo.url,
            },
            initContainers: [this.createInitContainer(volumeMounts)],
            resources: {
                requests: { memory: '512Mi' },
                limits: { memory: '2Gi' },
            },
        });
    }

    private createInitContainer(volumeMounts: VolumeMount[]) {
        return {
            name: 'init-media-folders',
            command: [
                'sh',
                '-c',
                [
                    `mkdir -p /media/downloads`,
                    `mkdir -p /media/movies`,
                    `mkdir -p /media/shows`,
                    `mkdir -p /media/music`,
                    `chown -R 1000:1000 /media`,
                ].join(' && '),
            ],
            volumeMounts,
        };
    }
}
