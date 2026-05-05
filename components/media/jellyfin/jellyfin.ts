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

        this.app = new Application(this, name)
            .addStorage()
            .addLocalStorage({
                name: 'media',
                hostPath: config.require(this.name, 'media/hostPath'),
            });

        this.createDeployment();
    }

    private createDeployment() {
        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();
        const mediaPath = config.require(this.name, 'media/path');
        const volumeMounts = this.createVolumeMounts(mediaPath);

        return this.app.addDeployment({
            ports: [
                { name: 'http', port: 8096 },
                { name: 'udp', port: 7359, protocol: 'udp', private: true },
            ],
            volumeMounts,
            env: {
                JELLYFIN_DATA_DIR: '/config',
                JELLYFIN_CACHE_DIR: '/config/cache',
                JELLYFIN_PublishedServerUrl: httpEndpointInfo.url,
            },
            initContainers: [this.createInitContainer(mediaPath, volumeMounts)],
            resources: {
                requests: { memory: '512Mi' },
                limits: { memory: '2Gi' },
            },
        });
    }

    private createVolumeMounts(mediaPath: string): VolumeMount[] {
        return [
            { mountPath: '/config' },
            { mountPath: mediaPath, name: 'media' },
        ];
    }

    private createInitContainer(mediaPath: string, volumeMounts: VolumeMount[]) {
        return {
            name: 'init-media-folders',
            command: [
                'sh',
                '-c',
                [
                    `mkdir -p ${mediaPath}/downloads`,
                    `mkdir -p ${mediaPath}/movies`,
                    `mkdir -p ${mediaPath}/shows`,
                    `mkdir -p ${mediaPath}/books`,
                    `mkdir -p ${mediaPath}/home-videos`,
                    `mkdir -p ${mediaPath}/music-videos`,
                    `chown -R 1000:1000 ${mediaPath}`,
                ].join(' && '),
            ],
            volumeMounts,
        };
    }
}

