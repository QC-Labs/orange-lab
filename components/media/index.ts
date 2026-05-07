import * as pulumi from '@pulumi/pulumi';
import { config } from '@orangelab/config';
import { Immich } from './immich/immich';
import { Jellyfin } from './jellyfin/jellyfin';
import { Prowlarr } from './prowlarr/prowlarr';
import { Radarr } from './radarr/radarr';
import { Seerr } from './seerr/seerr';
import { Sonarr } from './sonarr/sonarr';
import { Transmission } from './transmission/transmission';

export class MediaModule extends pulumi.ComponentResource {
    private readonly immich?: Immich;
    private readonly jellyfin?: Jellyfin;
    private readonly prowlarr?: Prowlarr;
    private readonly radarr?: Radarr;
    private readonly seerr?: Seerr;
    private readonly sonarr?: Sonarr;
    private readonly transmission?: Transmission;

    getExports() {
        return {
            endpoints: {
                ...this.jellyfin?.app.network.endpoints,
                ...this.immich?.app.network.endpoints,
                ...this.prowlarr?.app.network.endpoints,
                ...this.radarr?.app.network.endpoints,
                ...this.seerr?.app.network.endpoints,
                ...this.sonarr?.app.network.endpoints,
                ...this.transmission?.app.network.endpoints,
            },
            clusterUrls: {
                jellyfin: this.jellyfin?.app.network.clusterEndpoints.jellyfin,
                prowlarr: this.prowlarr?.app.network.clusterEndpoints.prowlarr,
                radarr: this.radarr?.app.network.clusterEndpoints.radarr,
                sonarr: this.sonarr?.app.network.clusterEndpoints.sonarr,
                transmission:
                    this.transmission?.app.network.clusterEndpoints.transmission,
            },
            immich: this.immich
                ? {
                      jwtSecret: this.immich.jwtSecret,
                      db: this.immich.dbConfig,
                  }
                : undefined,
        };
    }

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super('orangelab:media', name, {}, opts);

        if (config.isEnabled('immich')) {
            this.immich = new Immich('immich', { parent: this });
        }

        if (config.isEnabled('jellyfin')) {
            this.jellyfin = new Jellyfin('jellyfin', { parent: this });
        }

        if (config.isEnabled('prowlarr')) {
            this.prowlarr = new Prowlarr('prowlarr', { parent: this });
        }

        if (config.isEnabled('radarr')) {
            this.radarr = new Radarr('radarr', { parent: this });
        }

        if (config.isEnabled('sonarr')) {
            this.sonarr = new Sonarr('sonarr', { parent: this });
        }

        if (config.isEnabled('transmission')) {
            this.transmission = new Transmission('transmission', { parent: this });
        }

        if (config.isEnabled('seerr')) {
            this.seerr = new Seerr('seerr', {
                parent: this,
                dependsOn: [
                    this.jellyfin,
                    this.radarr,
                    this.sonarr,
                    this.transmission,
                ].filter(x => x !== undefined),
            });
        }
    }
}
