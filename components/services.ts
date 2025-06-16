import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Containers } from './containers';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import { Storage } from './storage';
import { ContainerSpec } from './types';
import { Databases } from './databases';

/**
 * Services class handles creation of Deployments, DaemonSets, Jobs, and ServiceAccounts for an application.
 */
export class Services {
    private serviceAccount?: kubernetes.core.v1.ServiceAccount;

    private readonly appName: string;
    private readonly scope: pulumi.ComponentResource;
    private readonly metadata: Metadata;
    private readonly storage: Storage;
    private readonly nodes: Nodes;
    private readonly config: pulumi.Config;
    private readonly databases: Databases;

    constructor(
        appName: string,
        params: {
            scope: pulumi.ComponentResource;
            metadata: Metadata;
            storage: Storage;
            nodes: Nodes;
            config: pulumi.Config;
            databases: Databases;
        },
    ) {
        this.appName = appName;
        this.scope = params.scope;
        this.metadata = params.metadata;
        this.storage = params.storage;
        this.nodes = params.nodes;
        this.config = params.config;
        this.databases = params.databases;
    }

    private getServiceAccount() {
        this.serviceAccount ??= this.createServiceAccount();
        return this.serviceAccount;
    }

    private createServiceAccount() {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.appName}-sa`,
            { metadata: this.metadata.get() },
            { parent: this.scope },
        );
    }

    createDeployment(spec: ContainerSpec) {
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(this.appName, {
            scope: this.scope,
            metadata: this.metadata,
            storage: this.storage,
            serviceAccount,
            nodes: this.nodes,
            config: this.config,
        });
        const metadata = this.metadata.get({ component: spec.name });
        return new kubernetes.apps.v1.Deployment(
            `${metadata.name}-deployment`,
            {
                metadata,
                spec: {
                    replicas: 1,
                    selector: { matchLabels: this.metadata.getSelectorLabels(spec.name) },
                    template: podSpec.createPodTemplateSpec(spec),
                    strategy: { type: 'Recreate', rollingUpdate: undefined },
                },
            },
            {
                parent: this.scope,
                deleteBeforeReplace: true,
                dependsOn: [this.storage, ...this.databases.getDependencies()],
            },
        );
    }

    createDaemonSet(spec: ContainerSpec) {
        assert(spec.name, 'name is required for daemonset');
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(this.appName, {
            scope: this.scope,
            metadata: this.metadata,
            serviceAccount,
            config: this.config,
            nodes: this.nodes,
            storage: this.storage,
        });
        return new kubernetes.apps.v1.DaemonSet(
            `${this.appName}-${spec.name}-daemonset`,
            {
                metadata: this.metadata.get({ component: spec.name }),
                spec: {
                    selector: {
                        matchLabels: this.metadata.getSelectorLabels(spec.name),
                    },
                    template: podSpec.createPodTemplateSpec(spec),
                },
            },
            {
                parent: this.scope,
                dependsOn: [this.storage, ...this.databases.getDependencies()],
            },
        );
    }

    createJob(spec: ContainerSpec) {
        assert(spec.name, 'name is required for job');
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(this.appName, {
            scope: this.scope,
            metadata: this.metadata,
            storage: this.storage,
            serviceAccount,
            config: this.config,
            nodes: this.nodes,
        });
        return new kubernetes.batch.v1.Job(
            `${this.appName}-${spec.name}-job`,
            {
                metadata: this.metadata.get({ component: spec.name }),
                spec: {
                    template: podSpec.createPodTemplateSpec(spec),
                },
            },
            {
                parent: this.scope,
                dependsOn: [this.storage, ...this.databases.getDependencies()],
            },
        );
    }
}
