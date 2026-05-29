import { config } from '@orangelab/pulumi';
import { Nextcloud } from './components/nextcloud/nextcloud';
import { Vaultwarden } from './components/vaultwarden/vaultwarden';

const nextcloud = config.isEnabled('nextcloud') ? new Nextcloud('nextcloud') : undefined;
const vaultwarden = config.isEnabled('vaultwarden')
    ? new Vaultwarden('vaultwarden')
    : undefined;

export const endpoints = {
    ...nextcloud?.app.network.endpoints,
    ...vaultwarden?.app.network.endpoints,
};

export const clusterUrls = {
    nextcloud: nextcloud?.app.network.clusterEndpoints.nextcloud,
    vaultwarden: vaultwarden?.app.network.clusterEndpoints.vaultwarden,
};

export const apps = {
    nextcloud: nextcloud
        ? {
              users: nextcloud.users,
              db: nextcloud.dbConfig,
          }
        : undefined,
    vaultwarden: vaultwarden
        ? {
              adminToken: vaultwarden.adminToken,
          }
        : undefined,
};
