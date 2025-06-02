import * as kubernetes from '@pulumi/kubernetes';
import { ClusterRole } from '@pulumi/kubernetes/rbac/v1';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { GrafanaDashboard } from '../../grafana-dashboard';
import dashboardJson from './tailscale-dashboard.json';

interface TailscaleOperatorArgs {
    namespace?: string;
    enableMonitoring?: boolean;
}

export class TailscaleOperator extends pulumi.ComponentResource {
    private readonly app: Application;

    constructor(
        private name: string,
        args: TailscaleOperatorArgs = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:TailscaleOperator', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.get('version');
        const hostname = config.require('hostname');
        const oauthClientId = config.requireSecret('oauthClientId');
        const oauthClientSecret = config.requireSecret('oauthClientSecret');

        this.app = new Application(this, name, {
            namespace: args.namespace,
        }).addDefaultLimits({
            request: { cpu: '10m', memory: '100Mi' },
            limit: { memory: '300Mi' },
        });

        const userRole = this.createUserRole(name);
        this.createUserRoleBinding(userRole, 'orangelab:users');

        let proxyClass;
        if (args.enableMonitoring) {
            proxyClass = new kubernetes.apiextensions.CustomResource(
                'proxyClass',
                {
                    apiVersion: 'tailscale.com/v1alpha1',
                    kind: 'ProxyClass',
                    metadata: {
                        name: 'tailscale-proxyclass',
                        namespace: this.app.namespace,
                    },
                    spec: {
                        metrics: {
                            enable: true,
                            serviceMonitor: {
                                enable: true,
                            },
                        },
                    },
                },
                { parent: this },
            );
            new GrafanaDashboard(name, this, { configJson: dashboardJson });
        }

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'tailscale-operator',
                namespace: this.app.namespace,
                version,
                repositoryOpts: { repo: 'https://pkgs.tailscale.com/helmcharts' },
                values: {
                    oauth: { clientId: oauthClientId, clientSecret: oauthClientSecret },
                    apiServerProxyConfig: { mode: 'true' },
                    operatorConfig: {
                        hostname,
                        logging: 'debug', // info, debug, dev
                    },
                    proxyConfig: args.enableMonitoring
                        ? { defaultProxyClass: proxyClass?.metadata.name }
                        : undefined,
                },
            },
            { parent: this },
        );
    }

    private createUserRoleBinding(userRole: ClusterRole, groupName: string) {
        new kubernetes.rbac.v1.ClusterRoleBinding(
            `${this.name}-user-cluster-role-binding`,
            {
                metadata: { ...this.app.metadata.get(), name: 'orangelab-user' },
                subjects: [
                    {
                        kind: 'Group',
                        name: groupName,
                    },
                ],
                roleRef: {
                    apiGroup: 'rbac.authorization.k8s.io',
                    kind: 'ClusterRole',
                    name: userRole.metadata.name,
                },
            },
            { parent: this },
        );
    }

    private createUserRole(name: string) {
        return new kubernetes.rbac.v1.ClusterRole(
            `${name}-user-cluster-role`,
            {
                metadata: {
                    ...this.app.metadata.get(),
                    name: 'orangelab-user-cluster-role',
                },
                rules: [
                    {
                        apiGroups: [
                            '',
                            'admissionregistration.k8s.io',
                            'apiextensions',
                            'apps',
                            'autoscaling',
                            'batch',
                            'coordination.k8s.io',
                            'discovery.k8s.io',
                            'extensions',
                            'helm.cattle.io',
                            'metrics.k8s.io',
                            'networking.k8s.io',
                            'node.k8s.io',
                            'policy',
                            'rbac.authorization.k8s.io',
                            'scheduling.k8s.io',
                            'storage.k8s.io',
                        ],
                        resources: ['*'],
                        verbs: ['get', 'list', 'watch'],
                    },
                ],
            },
            { parent: this },
        );
    }
}
