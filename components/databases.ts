import * as pulumi from '@pulumi/pulumi';
import { MariaDbCluster } from './mariadb';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import { PostgresCluster } from './postgres';
import { rootConfig } from './root-config';
import { Storage } from './storage';
import { DatabaseConfig, InitContainerSpec, StorageType } from './types';

export class Databases {
    private databases: Record<string, MariaDbCluster | PostgresCluster | undefined> = {};

    constructor(
        private appName: string,
        private args: {
            config: pulumi.Config;
            metadata: Metadata;
            nodes: Nodes;
            storage: Storage;
            storageOnly?: boolean;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {}

    addMariaDB(name = 'db'): void {
        rootConfig.require(this.appName, 'mariadb-operator');
        if (this.databases[name]) {
            throw new Error(`Database ${this.appName}-${name} already exists.`);
        }
        this.args.storage.addPersistentVolume({
            name,
            overrideFullname: `storage-${this.appName}-${name}-0`,
            type: StorageType.Database,
        });
        const enabledDefault = this.args.config.getBoolean(`storageOnly`) ? false : true;
        const db = new MariaDbCluster(
            this.appName,
            {
                affinity: this.args.nodes.getAffinity(name),
                disableAuth: this.args.config.getBoolean(`${name}/disableAuth`),
                enabled: this.args.config.getBoolean(`${name}/enabled`) ?? enabledDefault,
                metadata: this.args.metadata,
                name,
                password: this.args.config.getSecret(`${name}/password`),
                rootPassword: this.args.config.getSecret(`${name}/rootPassword`),
                storageClassName: this.args.storage.getStorageClass(name),
                storageOnly: this.args.storageOnly,
                storageSize: this.args.storage.getStorageSize(name),
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
        const existingVolume = this.args.config.get(`${name}/fromVolume`);
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
        const enabledDefault = this.args.config.getBoolean(`storageOnly`) ? false : true;
        const db = new PostgresCluster(
            this.appName,
            {
                enabled: this.args.config.getBoolean(`${name}/enabled`) ?? enabledDefault,
                fromPVC: existingVolume
                    ? this.args.storage.getClaimName(name)
                    : undefined,
                imageVersion: this.args.config.get(`${name}/imageVersion`),
                instances: this.args.config.getNumber(`${name}/instances`),
                metadata: this.args.metadata,
                name,
                nodes: this.args.nodes,
                password: this.args.config.getSecret(`${name}/password`),
                storageClassName: existingVolume
                    ? this.args.storage.getStorageClass(name)
                    : rootConfig.storageClass.Database,
                storageSize: this.args.config.require(`${name}/storageSize`),
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
