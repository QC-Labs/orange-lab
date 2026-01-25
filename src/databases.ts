import * as pulumi from '@pulumi/pulumi';
import { config } from './config';
import { MariaDbCluster } from './mariadb';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import { PostgresCluster } from './postgres';
import { Storage } from './storage';
import { DatabaseConfig, InitContainerSpec, StorageType } from './types';

export class Databases {
    private databases: Record<string, MariaDbCluster | PostgresCluster | undefined> = {};

    constructor(
        private appName: string,
        private args: {
            metadata: Metadata;
            nodes: Nodes;
            storage: Storage;
            storageOnly?: boolean;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {}

    addMariaDB(name = 'db'): void {
        config.requireEnabled(this.appName, 'mariadb-operator');
        if (this.databases[name]) {
            throw new Error(`Database ${this.appName}-${name} already exists.`);
        }
        this.args.storage.addPersistentVolume({
            name,
            overrideFullname: `storage-${this.appName}-${name}-0`,
            type: StorageType.Database,
        });
        const enabledDefault = config.getBoolean(this.appName, `storageOnly`)
            ? false
            : true;
        const db = new MariaDbCluster(
            this.appName,
            {
                affinity: this.args.nodes.getAffinity(name),
                disableAuth: config.getBoolean(this.appName, `${name}/disableAuth`),
                enabled:
                    config.getBoolean(this.appName, `${name}/enabled`) ?? enabledDefault,
                metadata: this.args.metadata,
                name,
                password: config.getSecret(this.appName, `${name}/password`),
                rootPassword: config.getSecret(this.appName, `${name}/rootPassword`),
                storageClassName: this.args.storage.getStorageClass(name),
                storageOnly: this.args.storageOnly,
                storageSize: this.args.storage.getStorageSize(name),
            },
            this.opts,
        );
        this.databases[name] = db;
    }

    addPostgres(name = 'db'): void {
        config.requireEnabled(this.appName, 'cloudnative-pg');
        if (this.databases[name]) {
            throw new Error(`Database ${this.appName}-${name} already exists.`);
        }
        const existingVolume = config.get(this.appName, `${name}/fromVolume`);
        if (existingVolume) {
            this.args.storage.addPersistentVolume({
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
        const enabledDefault = config.getBoolean(this.appName, `storageOnly`)
            ? false
            : true;
        const db = new PostgresCluster(
            this.appName,
            {
                enabled:
                    config.getBoolean(this.appName, `${name}/enabled`) ?? enabledDefault,
                fromPVC: existingVolume
                    ? this.args.storage.getClaimName(name)
                    : undefined,
                imageVersion: config.get(this.appName, `${name}/imageVersion`),
                instances: config.getNumber(this.appName, `${name}/instances`),
                metadata: this.args.metadata,
                name,
                nodes: this.args.nodes,
                password: config.getSecret(this.appName, `${name}/password`),
                storageClassName: existingVolume
                    ? this.args.storage.getStorageClass(name)
                    : config.storageClass.Database,
                storageSize: config.require(this.appName, `${name}/storageSize`),
            },
            this.opts,
        );
        this.databases[name] = db;
    }

    /**
     * Returns the config for MariaDB or PostgreSQL instance for this app.
     * Includes: hostname, database, username, password
     */
    getConfig(name = 'db'): DatabaseConfig {
        const db = this.databases[name];
        if (!db) throw new Error(`Database ${this.appName}-${name} not found.`);
        return db.getConfig();
    }

    /**
     * Returns an initContainer spec to wait for database until it accepts connections.
     */
    getWaitContainer(dbConfig: DatabaseConfig = this.getConfig()): InitContainerSpec {
        const hostPort = pulumi.interpolate`${dbConfig.hostname} ${dbConfig.port}`;
        return {
            name: 'wait-for-db',
            image: 'busybox:latest',
            command: pulumi.all([
                'sh',
                '-c',
                pulumi.interpolate`until nc -z -v -w30 ${hostPort}; do echo "Waiting for database...${hostPort}" && sleep 5; done`,
            ]),
            volumeMounts: [],
        };
    }
}
