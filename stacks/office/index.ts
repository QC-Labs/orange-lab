import { config } from '@orangelab/pulumi';
import { Nextcloud } from './apps/nextcloud/nextcloud';

const nextcloud = config.isEnabled('nextcloud') ? new Nextcloud('nextcloud') : undefined;

export const endpoints = {
    nextcloud: nextcloud?.serviceUrl,
};

export const apps = {
    nextcloud: {
        users: nextcloud?.users,
        db: nextcloud?.dbConfig,
    },
};
