import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Databases } from './databases';
import { Metadata } from './metadata';
import { Network } from './network';
import { Nodes } from './nodes';
import { rootConfig } from './root-config';
import { Services } from './services';
import { Storage } from './storage';
import { ConfigVolume, ContainerSpec, LocalVolume, PersistentVolume } from './types';

/**
 * Application class provides DSL (Domain Specific Language) to simplify creation of Kubernetes manifests.
 *
 * Limitations:
 * - max one DaemonSet
 * - no endpoints for DaemonSet
 * - persistent storage for DaemonSets not supported
 */
export class Application {
    storageOnly = false;
    readonly metadata: Metadata;
    readonly nodes: Nodes;
    readonly network: Network;
    databases?: Databases;
    storage?: Storage;

    private readonly config: pulumi.Config;
    private services?: Services;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        args?: {
            namespace?: string;
            existingNamespace?: string;
            gpu?: boolean;
        },
    ) {
        this.config = new pulumi.Config(appName);
        this.processDeprecated();
        this.storageOnly = this.config.getBoolean('storageOnly') ?? false;
        this.metadata = new Metadata(
            appName,
            {
                config: this.config,
                namespace: args?.namespace,
                existingNamespace: args?.existingNamespace,
            },
            { parent: this.scope },
        );
        this.nodes = new Nodes({
            config: this.config,
            gpu: args?.gpu,
        });
        this.network = new Network(
            appName,
            {
                config: this.config,
                metadata: this.metadata,
            },
            { parent: this.scope },
        );
    }

    private processDeprecated() {
        assert(
            !this.config.get('fromBackup'),
            `${this.appName}:fromBackup is not supported. Use fromVolume instead.`,
        );
        assert(
            !this.config.get('cloneFromClaim'),
            `${this.appName}:cloneFromClaim is not supported. Use fromVolume instead.`,
        );
    }

    private getStorage() {
        this.storage =
            this.storage ??
            new Storage(
                this.appName,
                {
                    config: this.config,
                    metadata: this.metadata,
                    nodes: this.nodes,
                },
                { parent: this.scope },
            );
        return this.storage;
    }

    private getDatabases() {
        this.databases =
            this.databases ??
            new Databases(
                this.appName,
                {
                    config: this.config,
                    metadata: this.metadata,
                    nodes: this.nodes,
                    storage: this.getStorage(),
                    storageOnly: this.storageOnly,
                },
                { parent: this.scope },
            );
        return this.databases;
    }

    private getServices() {
        this.services =
            this.services ??
            new Services(
                this.appName,
                {
                    metadata: this.metadata,
                    storage: this.storage,
                    nodes: this.nodes,
                    config: this.config,
                },
                { parent: this.scope },
            );
        return this.services;
    }

    /**
     * Adds a MariaDB database using the MariaDB Operator CRD.
     * Creates a database, user and storage.
     */
    addMariaDB() {
        this.getDatabases().addMariaDB();
        return this;
    }

    /**
     * Adds a PostgreSQL database using the CloudNativePG Operator CRD.
     * Creates a database, user and storage.
     */
    addPostgres() {
        this.getDatabases().addPostgres();
        return this;
    }

    addStorage(volume?: PersistentVolume) {
        this.getStorage().addPersistentVolume(volume);
        return this;
    }

    addLocalStorage(volume: LocalVolume) {
        this.getStorage().addLocalVolume(volume);
        return this;
    }

    /**
     * Adds a config volume that contains multiple configuration files mounted in the same folder.
     * @param configVolume The config volume definition (name and files)
     */
    addConfigVolume(configVolume: ConfigVolume) {
        if (this.storageOnly) return this;
        this.getStorage().addConfigVolume(configVolume);
        return this;
    }

    addDeployment(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        this.getServices().createDeployment(spec);
        this.network.createEndpoints(spec);
        return this;
    }

    addDaemonSet(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        this.getServices().createDaemonSet(spec);
        return this;
    }

    addJob(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        this.getServices().createJob(spec);
        return this;
    }

    addHelmChart(
        name: string,
        args: {
            chart: string;
            repo: string;
            values?: pulumi.Inputs;
            skipCrds?: boolean;
        },
        opts?: pulumi.CustomResourceOptions,
    ) {
        return new kubernetes.helm.v3.Release(
            name,
            {
                chart: args.chart,
                namespace: this.metadata.namespace,
                version: this.config.get('version'),
                repositoryOpts: { repo: args.repo },
                maxHistory: rootConfig.helmHistoryLimit,
                skipCrds: args.skipCrds,
                values: args.values,
            },
            { ...opts, parent: this.scope },
        );
    }
}
