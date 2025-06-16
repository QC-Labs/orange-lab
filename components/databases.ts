import * as pulumi from '@pulumi/pulumi';
import { MariaDbCluster } from './mariadb';
import { Metadata } from './metadata';
import { rootConfig } from './root-config';
import { Storage } from './storage';
import { DatabaseConfig } from './types';

export class Databases {
    private readonly databases: Record<string, MariaDbCluster | undefined> = {};
    private readonly appName: string;
    private readonly storage: Storage;
    private readonly storageOnly: boolean;
    private readonly metadata: Metadata;
    private readonly config: pulumi.Config;

    constructor(
        appName: string,
        args: {
            config: pulumi.Config;
            metadata: Metadata;
            storage: Storage;
            storageOnly?: boolean;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {
        this.appName = appName;
        this.storage = args.storage;
        this.storageOnly = args.storageOnly ?? false;
        this.metadata = args.metadata;
        this.config = args.config;
    }

    addMariaDB(name = 'db'): void {
        rootConfig.require(this.appName, 'mariadb-operator');
        if (this.databases[name]) {
            throw new Error(`MariaDB ${this.appName}-${name} already exists.`);
        }
        this.storage.addPersistentVolume({
            name,
            overrideFullname: `storage-${this.appName}-${name}-0`,
        });
        const db = new MariaDbCluster(
            this.appName,
            {
                name,
                metadata: this.metadata,
                storageSize: this.storage.getStorageSize(name),
                storageClassName: this.storage.getStorageClass(name),
                storageOnly: this.storageOnly,
                maintananceMode: this.config.getBoolean(`${name}/maintenance`),
            },
            this.opts,
        );
        this.databases[name] = db;
    }

    /**
     * Returns the config for the MariaDB instance for this app.
     * Includes: hostname, database, username, password
     */
    getMariaDbConfig(name = 'db'): DatabaseConfig {
        const db = this.databases[name];
        if (!db) throw new Error(`MariaDB ${this.appName}-${name} not found.`);
        return db.getConfig();
    }

    getDependencies(): pulumi.Resource[] {
        return Object.values(this.databases).filter(
            db => db !== undefined,
        ) as pulumi.Resource[];
    }
}
