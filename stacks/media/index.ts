import { config } from '@orangelab/pulumi';
import { Immich } from './components/immich/immich';
import { Jellyfin } from './components/jellyfin/jellyfin';
import { Lidarr } from './components/lidarr/lidarr';
import { MusicSeerr } from './components/musicseerr/musicseerr';
import { Prowlarr } from './components/prowlarr/prowlarr';
import { Radarr } from './components/radarr/radarr';
import { Seerr } from './components/seerr/seerr';
import { Sonarr } from './components/sonarr/sonarr';
import { Transmission } from './components/transmission/transmission';

const jellyfin = config.isEnabled('jellyfin') ? new Jellyfin('jellyfin') : undefined;
const immich = config.isEnabled('immich') ? new Immich('immich') : undefined;
const lidarr = config.isEnabled('lidarr') ? new Lidarr('lidarr') : undefined;
const prowlarr = config.isEnabled('prowlarr') ? new Prowlarr('prowlarr') : undefined;
const radarr = config.isEnabled('radarr') ? new Radarr('radarr') : undefined;
const sonarr = config.isEnabled('sonarr') ? new Sonarr('sonarr') : undefined;
const transmission = config.isEnabled('transmission')
    ? new Transmission('transmission')
    : undefined;

const musicseerr = config.isEnabled('musicseerr')
    ? new MusicSeerr('musicseerr', {
          dependsOn: [lidarr, jellyfin].filter(x => x !== undefined),
      })
    : undefined;

const seerr = config.isEnabled('seerr')
    ? new Seerr('seerr', {
          dependsOn: [jellyfin, radarr, sonarr, transmission].filter(
              x => x !== undefined,
          ),
      })
    : undefined;

export const endpoints = {
    ...jellyfin?.app.network.endpoints,
    ...immich?.app.network.endpoints,
    ...lidarr?.app.network.endpoints,
    ...musicseerr?.app.network.endpoints,
    ...prowlarr?.app.network.endpoints,
    ...radarr?.app.network.endpoints,
    ...seerr?.app.network.endpoints,
    ...sonarr?.app.network.endpoints,
    ...transmission?.app.network.endpoints,
};

export const clusterUrls = {
    jellyfin: jellyfin?.app.network.clusterEndpoints.jellyfin,
    lidarr: lidarr?.app.network.clusterEndpoints.lidarr,
    prowlarr: prowlarr?.app.network.clusterEndpoints.prowlarr,
    radarr: radarr?.app.network.clusterEndpoints.radarr,
    sonarr: sonarr?.app.network.clusterEndpoints.sonarr,
    transmission: transmission?.app.network.clusterEndpoints.transmission,
};

export const apps = {
    immich: immich
        ? {
              jwtSecret: immich.jwtSecret,
              db: immich.dbConfig,
          }
        : undefined,
};
