import * as kubernetes from '@pulumi/kubernetes';
import { LimitRange } from '@pulumi/kubernetes/core/v1';
import * as pulumi from '@pulumi/pulumi';
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
 * - only one Deployment supported
 * - max one DaemonSet
 * - no endpoints for DaemonSet
 * - persistent storage for DaemonSets not supported
 */
export class Application {
    endpointUrl?: string;
    serviceUrl?: string;
    storageOnly = false;
    readonly metadata: Metadata;
    readonly nodes: Nodes;
    readonly storage: Storage;
    readonly network: Network;
    readonly namespace: string;

    private readonly config: pulumi.Config;
    private gpu?: 'nvidia' | 'amd';
    private readonly services: Services;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        args?: {
            domainName?: string;
            namespace?: string;
            existingNamespace?: string;
            gpu?: boolean;
        },
    ) {
        this.config = new pulumi.Config(appName);
        this.storageOnly = this.config.getBoolean('storageOnly') ?? false;
        if (args?.gpu) {
            const useAmdGpu = this.config.getBoolean('amd-gpu') ?? false;
            this.gpu = useAmdGpu ? 'amd' : 'nvidia';
        }

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
            gpu: this.gpu,
        });
        this.storage = new Storage(appName, {
            scope: this.scope,
            config: this.config,
            namespace: this.namespace,
            metadata: this.metadata,
            nodes: this.nodes,
        });
        this.network = new Network(appName, {
            scope: this.scope,
            config: this.config,
            metadata: this.metadata,
            domainName: args?.domainName,
        });
        this.services = new Services(
            this.scope,
            this.appName,
            this.metadata,
            this.storage,
            this.nodes,
            this.config,
            this.gpu,
        );
    }

    addStorage(volume?: PersistentVolume) {
        this.storage.addPersistentVolume(volume);
        return this;
    }

    addLocalStorage(volume: LocalVolume) {
        this.storage.addLocalVolume(volume);
        return this;
    }

    /**
     * Adds a config volume that contains multiple configuration files mounted in the same folder.
     * @param configVolume The config volume definition (name and files)
     */
    addConfigVolume(configVolume: ConfigVolume) {
        if (this.storageOnly) return this;
        this.storage.addConfigVolume(configVolume);
        return this;
    }

    addDeployment(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        if (spec.envSecret) {
            this.createEnvSecret(spec.envSecret);
        }
        this.services.createDeployment(spec);
        this.network.createEndpoints(spec);
        this.serviceUrl = this.network.serviceUrl;
        this.endpointUrl = this.network.endpointUrl;
        return this;
    }

    addDeamonSet(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        this.services.createDaemonSet(spec);
        return this;
    }

    addJob(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        this.services.createJob(spec);
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

    private createEnvSecret(
        secretData: Record<string, string | pulumi.Output<string> | undefined>,
    ): kubernetes.core.v1.Secret {
        return new kubernetes.core.v1.Secret(
            `${this.appName}-secret`,
            {
                metadata: this.metadata.get(),
                immutable: true,
                // filter out undefined values
                stringData: Object.fromEntries(
                    Object.entries(secretData)
                        .filter(([_, v]) => v !== undefined)
                        .map(([k, v]) => [k, pulumi.output(v).apply(String)]),
                ),
            },
            { parent: this.scope },
        );
    }
}
