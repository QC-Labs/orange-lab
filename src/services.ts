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
    constructor(
        private appName: string,
        private args: {
            metadata: Metadata;
            storage?: Storage;
            nodes: Nodes;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {}

    private getServiceAccount() {
        this.serviceAccount ??= this.createServiceAccount();
        return this.serviceAccount;
    }

    private createServiceAccount() {
        return new kubernetes.core.v1.ServiceAccount(
            `${this.appName}-sa`,
            { metadata: this.args.metadata.get() },
            this.opts,
        );
    }

    createDeployment(spec: ContainerSpec) {
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(
            this.appName,
            {
                metadata: this.args.metadata,
                storage: this.args.storage,
                serviceAccount,
                nodes: this.args.nodes,
            },
            this.opts,
        );
        const metadata = this.args.metadata.get({
            component: spec.name,
            includeVersionLabel: true,
        });
        return new kubernetes.apps.v1.Deployment(
            `${metadata.name}-deployment`,
            {
                metadata,
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: this.args.metadata.getSelectorLabels(spec.name),
                    },
                    template: podSpec.createPodTemplateSpec(spec),
                    strategy: { type: 'Recreate', rollingUpdate: undefined },
                },
            },
            {
                ...this.opts,
                deleteBeforeReplace: true,
                dependsOn: this.args.storage,
            },
        );
    }

    createDaemonSet(spec: ContainerSpec) {
        assert(spec.name, 'name is required for daemonset');
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(this.appName, {
            metadata: this.args.metadata,
            serviceAccount,
            nodes: this.args.nodes,
            storage: this.args.storage,
        });
        return new kubernetes.apps.v1.DaemonSet(
            `${this.appName}-${spec.name}-daemonset`,
            {
                metadata: this.args.metadata.get({ component: spec.name }),
                spec: {
                    selector: {
                        matchLabels: this.args.metadata.getSelectorLabels(spec.name),
                    },
                    template: podSpec.createPodTemplateSpec(spec),
                },
            },
            { ...this.opts, dependsOn: this.args.storage },
        );
    }

    createJob(spec: ContainerSpec) {
        assert(spec.name, 'name is required for job');
        const serviceAccount = this.getServiceAccount();
        const podSpec = new Containers(
            this.appName,
            {
                metadata: this.args.metadata,
                storage: this.args.storage,
                serviceAccount,
                nodes: this.args.nodes,
            },
            this.opts,
        );
        return new kubernetes.batch.v1.Job(
            `${this.appName}-${spec.name}-job`,
            {
                metadata: this.args.metadata.get({ component: spec.name }),
                spec: {
                    template: podSpec.createPodTemplateSpec(spec),
                },
            },
            { ...this.opts, dependsOn: this.args.storage },
        );
    }
}
