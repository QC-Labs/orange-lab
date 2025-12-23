import * as pulumi from '@pulumi/pulumi';
import { MariaDbCluster } from './mariadb';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import { PostgresCluster } from './postgres';
import { rootConfig } from './root-config';
import { Storage } from './storage';
import { DatabaseConfig, InitContainerSpec, StorageType } from './types';

export class Databases {
    private readonly databases: Record<
        string,
        MariaDbCluster | PostgresCluster | undefined
    > = {};
    private readonly storage: Storage;
    private readonly storageOnly: boolean;
    private readonly metadata: Metadata;
    private readonly config: pulumi.Config;
    private readonly nodes: Nodes;

    constructor(
        private appName: string,
        args: {
            config: pulumi.Config;
            metadata: Metadata;
            nodes: Nodes;
            storage: Storage;
            storageOnly?: boolean;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {
        this.storage = args.storage;
        this.storageOnly = args.storageOnly ?? false;
        this.metadata = args.metadata;
        this.nodes = args.nodes;
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
        const enabledDefault = this.config.getBoolean(`storageOnly`) ? false : true;
        const db = new MariaDbCluster(
            this.appName,
            {
                affinity: this.nodes.getAffinity(name),
                disableAuth: this.config.getBoolean(`${name}/disableAuth`),
                enabled: this.config.getBoolean(`${name}/enabled`) ?? enabledDefault,
                metadata: this.metadata,
                name,
                password: this.config.getSecret(`${name}/password`),
                rootPassword: this.config.getSecret(`${name}/rootPassword`),
                storageClassName: this.storage.getStorageClass(name),
                storageOnly: this.storageOnly,
                storageSize: this.storage.getStorageSize(name),
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
                enabled: this.config.getBoolean(`${name}/enabled`) ?? enabledDefault,
                fromPVC: existingVolume ? this.storage.getClaimName(name) : undefined,
                imageVersion: this.config.get(`${name}/imageVersion`),
                instances: this.config.getNumber(`${name}/instances`),
                metadata: this.metadata,
                name,
                nodes: this.nodes,
                password: this.config.getSecret(`${name}/password`),
                storageClassName: existingVolume
                    ? this.storage.getStorageClass(name)
                    : rootConfig.storageClass.Database,
                storageSize: this.config.require(`${name}/storageSize`),
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
        const hostPort = `${dbConfig.hostname} ${dbConfig.port.toString()}`;
        return {
            name: 'wait-for-db',
            image: 'busybox:latest',
            command: [
                'sh',
                '-c',
                `until nc -z -v -w30 ${hostPort}; do echo "Waiting for database...${hostPort}" && sleep 5; done`,
            ],
            volumeMounts: [],
        };
    }
}
