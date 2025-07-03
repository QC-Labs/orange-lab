import * as kubernetes from '@pulumi/kubernetes';
import { LimitRange } from '@pulumi/kubernetes/core/v1';
import * as pulumi from '@pulumi/pulumi';
import { Databases } from './databases';
import { Metadata } from './metadata';
import { Network } from './network';
import { Nodes } from './nodes';
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
    readonly namespace: string;
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
        this.storageOnly = this.config.getBoolean('storageOnly') ?? false;
        if (args?.existingNamespace) {
            this.namespace = args.existingNamespace;
        } else {
            this.namespace = args?.namespace ?? appName;
            this.createNamespace(this.namespace);
        }
        this.metadata = new Metadata(appName, {
            config: this.config,
            namespace: this.namespace,
        });
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

    private getStorage() {
        this.storage =
            this.storage ??
            new Storage(
                this.appName,
                {
                    config: this.config,
                    namespace: this.namespace,
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

    addDefaultLimits(args: {
        request?: Record<string, string>;
        limit?: Record<string, string>;
    }) {
        new LimitRange(
            `${this.appName}-limits`,
            {
                metadata: this.metadata.get(),
                spec: {
                    limits: [
                        {
                            type: 'Container',
                            defaultRequest: args.request,
                            default: args.limit,
                        },
                    ],
                },
            },
            { parent: this.scope },
        );
        return this;
    }

    private createNamespace(name: string) {
        return new kubernetes.core.v1.Namespace(
            `${this.appName}-ns`,
            { metadata: { name } },
            { parent: this.scope },
        );
    }
}
