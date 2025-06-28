import * as pulumi from '@pulumi/pulumi';
import { MariaDbCluster } from './mariadb';
import { Metadata } from './metadata';
import { PostgresCluster } from './postgres';
import { rootConfig } from './root-config';
import { Storage } from './storage';
import { DatabaseConfig, StorageType } from './types';

export class Databases {
    private readonly databases: Record<
        string,
        MariaDbCluster | PostgresCluster | undefined
    > = {};
    private readonly storage: Storage;
    private readonly storageOnly: boolean;
    private readonly metadata: Metadata;
    private readonly config: pulumi.Config;

    constructor(
        private appName: string,
        args: {
            config: pulumi.Config;
            metadata: Metadata;
            storage: Storage;
            storageOnly?: boolean;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {
        this.storage = args.storage;
        this.storageOnly = args.storageOnly ?? false;
        this.metadata = args.metadata;
        this.config = args.config;
    }

    addMariaDB(name = 'db'): void {
        rootConfig.require(this.appName, 'mariadb-operator');
        if (this.databases[name]) {
            throw new Error(`Database ${this.appName}-${name} already exists.`);
        }
        this.storage.addPersistentVolume({
            name,
            overrideFullname: `storage-${this.appName}-${name}-0`,
            type: StorageType.Database,
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

    addPostgres(name = 'db'): void {
        rootConfig.require(this.appName, 'cloudnative-pg');
        if (this.databases[name]) {
            throw new Error(`Database ${this.appName}-${name} already exists.`);
        }
        const existingVolume = this.config.get(`${name}/fromVolume`);
        if (existingVolume) {
            this.storage.addPersistentVolume({
                name,
                overrideFullname: `${this.appName}-${name}-1`,
                type: StorageType.Database,
                labels: {
                    'cnpg.io/cluster': `${this.appName}-${name}`,
                    'cnpg.io/instanceName': `${this.appName}-${name}-1`,
                    'cnpg.io/instanceRole': 'primary',
                    'cnpg.io/pvcRole': 'PG_DATA',
                    role: 'primary',
                },
                annotations: {
                    'cnpg.io/nodeSerial': '1',
                    'cnpg.io/pvcStatus': 'ready',
                },
            });
        }
        const enabledDefault = this.config.getBoolean(`storageOnly`) ? false : true;
        const db = new PostgresCluster(
            this.appName,
            {
                name,
                metadata: this.metadata,
                storageSize: this.config.require(`${name}/storageSize`),
                storageClassName: existingVolume
                    ? this.storage.getStorageClass(name)
                    : rootConfig.storageClass.Database,
                enabled: this.config.getBoolean(`${name}/enabled`) ?? enabledDefault,
                fromPVC: existingVolume ? this.storage.getClaimName(name) : undefined,
                instances: this.config.getNumber(`${name}/instances`),
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
        if (!db || !(db instanceof MariaDbCluster))
            throw new Error(`MariaDB ${this.appName}-${name} not found.`);
        return db.getConfig();
    }

    /**
     * Returns the config for the PostgreSQL instance for this app.
     * Includes: hostname, database, username, password
     */
    getPostgresConfig(name = 'db'): DatabaseConfig {
        const db = this.databases[name];
        if (!db || !(db instanceof PostgresCluster))
            throw new Error(`Postgres ${this.appName}-${name} not found.`);
        return db.getConfig();
    }

    getDependencies(): pulumi.Resource[] {
        return Object.values(this.databases).filter(
            db => db !== undefined,
        ) as pulumi.Resource[];
    }
}
