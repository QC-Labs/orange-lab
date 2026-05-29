import { config } from '@orangelab/pulumi';
import { Vaultwarden } from './components/vaultwarden/vaultwarden';

const vaultwarden = config.isEnabled('vaultwarden')
    ? new Vaultwarden('vaultwarden')
    : undefined;

export const endpoints = {
    ...vaultwarden?.app.network.endpoints,
};

export const clusterUrls = {
    vaultwarden: vaultwarden?.app.network.clusterEndpoints.vaultwarden,
};

export const apps = {
    vaultwarden: vaultwarden
        ? {
              adminToken: vaultwarden.adminToken,
          }
        : undefined,
};
