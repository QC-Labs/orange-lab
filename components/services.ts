import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Containers } from './containers';
import { Metadata } from './metadata';
import { Nodes } from './nodes';
import { Storage } from './storage';
import { ContainerSpec } from './types';

/**
 * Services class handles creation of Deployments, DaemonSets, Jobs, and ServiceAccounts for an application.
 */
export class Services {
    private serviceAccount?: kubernetes.core.v1.ServiceAccount;

    private readonly appName: string;
    private readonly metadata: Metadata;
    private readonly storage?: Storage;
    private readonly nodes: Nodes;
    private readonly config: pulumi.Config;

    constructor(
        appName: string,
        params: {
            metadata: Metadata;
            storage?: Storage;
            nodes: Nodes;
            config: pulumi.Config;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {
        this.appName = appName;
        this.metadata = params.metadata;
        this.storage = params.storage;
        this.nodes = params.nodes;
        this.config = params.config;
    }

    private getServiceAccount() {
        this.serviceAccount ??= this.createServiceAccount();
        return this.serviceAccount;
    }

    private createServiceAccount() {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.appName}-sa`,
            { metadata: this.metadata.get() },
            this.opts,
        );
    }

    createDeployment(spec: ContainerSpec) {
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(
            this.appName,
            {
                metadata: this.metadata,
                storage: this.storage,
                serviceAccount,
                nodes: this.nodes,
                config: this.config,
            },
            this.opts,
        );
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
                ...this.opts,
                deleteBeforeReplace: true,
            },
        );
    }

    createDaemonSet(spec: ContainerSpec) {
        assert(spec.name, 'name is required for daemonset');
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(this.appName, {
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
            this.opts,
        );
    }

    createJob(spec: ContainerSpec) {
        assert(spec.name, 'name is required for job');
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(
            this.appName,
            {
                metadata: this.metadata,
                storage: this.storage,
                serviceAccount,
                config: this.config,
                nodes: this.nodes,
            },
            this.opts,
        );
        return new kubernetes.batch.v1.Job(
            `${this.appName}-${spec.name}-job`,
            {
                metadata: this.metadata.get({ component: spec.name }),
                spec: {
                    template: podSpec.createPodTemplateSpec(spec),
                },
            },
            this.opts,
        );
    }
}
