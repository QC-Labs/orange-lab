import * as kubernetes from '@pulumi/kubernetes';
import { LimitRange } from '@pulumi/kubernetes/core/v1';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Containers } from './containers';
import { ContainerSpec } from './types';
import { Metadata } from './metadata';
import { Network } from './network';
import { Nodes } from './nodes';
import { LocalVolume, PersistentVolume, Storage } from './storage';

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
    private serviceAccount?: kubernetes.core.v1.ServiceAccount;
    private gpu?: 'nvidia' | 'amd';

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        private readonly args?: {
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
        });
        this.network = new Network(appName, {
            scope: this.scope,
            config: this.config,
            metadata: this.metadata,
            domainName: args?.domainName,
        });
    }

    addStorage(volume?: PersistentVolume) {
        this.storage.addPersistentVolume(volume);
        return this;
    }

    addLocalStorage(volume: LocalVolume) {
        this.storage.addLocalVolume(volume);
        return this;
    }

    addDeployment(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        this.createDeployment(spec);

        this.network.createEndpoints(spec);
        this.serviceUrl = this.network.serviceUrl;
        this.endpointUrl = this.network.endpointUrl;

        return this;
    }

    addDeamonSet(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        this.createDaemonSet(spec);
        return this;
    }

    addJob(spec: ContainerSpec) {
        if (this.storageOnly) return this;
        this.serviceAccount = this.serviceAccount ?? this.createServiceAccount();
        this.createJob(spec);
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

    addConfigFile(filename: string, content: pulumi.Input<string>) {
        if (this.storageOnly) return this;
        this.storage.addConfigFile(filename, content);
        return this;
    }

    private createNamespace(name: string) {
        return new kubernetes.core.v1.Namespace(
            `${this.appName}-ns`,
            { metadata: { name } },
            { parent: this.scope },
        );
    }

    private createServiceAccount() {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.appName}-sa`,
            { metadata: this.metadata.get() },
            { parent: this.scope },
        );
    }

    private createDeployment(args: ContainerSpec) {
        assert(this.serviceAccount, 'serviceAccount is required');
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata: this.metadata.get(),
            storage: this.storage,
            serviceAccount: this.serviceAccount,
            affinity: this.nodes.getAffinity(),
            gpu: this.gpu,
            config: this.config,
        });
        return new kubernetes.apps.v1.Deployment(
            `${this.appName}-deployment`,
            {
                metadata: this.metadata.get(),
                spec: {
                    replicas: 1,
                    selector: { matchLabels: this.metadata.getSelectorLabels() },
                    template: podSpec.createPodTemplateSpec(),
                    strategy: this.storage.hasVolumes()
                        ? { type: 'Recreate', rollingUpdate: undefined }
                        : { type: 'RollingUpdate' },
                },
            },
            {
                parent: this.scope,
                deleteBeforeReplace: true,
                dependsOn: this.storage,
            },
        );
    }

    private createDaemonSet(args: ContainerSpec) {
        assert(args.name, 'name is required for daemonset');
        assert(this.serviceAccount, 'serviceAccount is required');
        const metadata = this.metadata.getForComponent(args.name);
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata,
            serviceAccount: this.serviceAccount,
            config: this.config,
        });
        return new kubernetes.apps.v1.DaemonSet(
            `${this.appName}-${args.name}-daemonset`,
            {
                metadata,
                spec: {
                    selector: {
                        matchLabels: this.metadata.getSelectorLabels(args.name),
                    },
                    template: podSpec.createPodTemplateSpec(),
                },
            },
            { parent: this.scope, dependsOn: this.storage },
        );
    }

    private createJob(args: ContainerSpec) {
        assert(args.name, 'name is required for job');
        assert(this.serviceAccount, 'serviceAccount is required');
        const metadata = this.metadata.getForComponent(args.name);
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata,
            storage: this.storage,
            serviceAccount: this.serviceAccount,
            affinity: this.nodes.getAffinity(),
            config: this.config,
        });
        return new kubernetes.batch.v1.Job(
            `${this.appName}-${args.name}-job`,
            {
                metadata,
                spec: {
                    template: podSpec.createPodTemplateSpec(),
                },
            },
            { parent: this.scope, dependsOn: this.storage },
        );
    }
}
