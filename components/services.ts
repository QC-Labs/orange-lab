import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Containers } from './containers';
import { Metadata } from './metadata';
import { Storage } from './storage';
import { Nodes } from './nodes';
import { ContainerSpec } from './types';

/**
 * Services class handles creation of Deployments, DaemonSets, Jobs, and ServiceAccounts for an application.
 */
export class Services {
    private serviceAccount?: kubernetes.core.v1.ServiceAccount;

    constructor(
        private readonly scope: pulumi.ComponentResource,
        private readonly appName: string,
        private readonly metadata: Metadata,
        private readonly storage: Storage,
        private readonly nodes: Nodes,
        private readonly config: pulumi.Config,
    ) {}

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

    createDeployment(args: ContainerSpec) {
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata: this.metadata.get({
                annotations: { 'checksum/config': this.storage.configFilesHash },
            }),
            storage: this.storage,
            serviceAccount,
            nodes: this.nodes,
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

    createDaemonSet(args: ContainerSpec) {
        assert(args.name, 'name is required for daemonset');
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata: this.metadata.get({
                component: args.name,
                annotations: { 'checksum/config': this.storage.configFilesHash },
            }),
            serviceAccount,
            config: this.config,
            nodes: this.nodes,
        });
        return new kubernetes.apps.v1.DaemonSet(
            `${this.appName}-${args.name}-daemonset`,
            {
                metadata: this.metadata.get({ component: args.name }),
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

    createJob(args: ContainerSpec) {
        assert(args.name, 'name is required for job');
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(this.appName, {
            spec: args,
            metadata: this.metadata.get({
                component: args.name,
                annotations: { 'checksum/config': this.storage.configFilesHash },
            }),
            storage: this.storage,
            serviceAccount,
            config: this.config,
            nodes: this.nodes,
        });
        return new kubernetes.batch.v1.Job(
            `${this.appName}-${args.name}-job`,
            {
                metadata: this.metadata.get({ component: args.name }),
                spec: {
                    template: podSpec.createPodTemplateSpec(),
                },
            },
            { parent: this.scope, dependsOn: this.storage },
        );
    }
}
