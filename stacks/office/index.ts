import { config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';
import { Nextcloud } from './apps/nextcloud/nextcloud';

const office = new pulumi.ComponentResource('orangelab:office', 'office', {});

const nextcloud = config.isEnabled('nextcloud')
    ? new Nextcloud('nextcloud', { parent: office })
    : undefined;

export const endpoints = {
    nextcloud: nextcloud?.serviceUrl,
};

export const nextcloudUsers = nextcloud?.users;
export const nextcloudDb = nextcloud?.dbConfig;
