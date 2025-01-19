import * as kubernetes from '@pulumi/kubernetes';
import { ClusterRole } from '@pulumi/kubernetes/rbac/v1';
import * as pulumi from '@pulumi/pulumi';

interface TailscaleOperatorArgs {
    namespace?: string;
}

export class TailscaleOperator extends pulumi.ComponentResource {
    constructor(
        private name: string,
        args: TailscaleOperatorArgs = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:TailscaleOperator', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.require('version');
        const hostname = config.require('hostname');
        const oauthClientId = config.requireSecret('oauthClientId');
        const oauthClientSecret = config.requireSecret('oauthClientSecret');

        const namespace = new kubernetes.core.v1.Namespace(
            `${name}-ns`,
            {
                metadata: { name: args.namespace ?? name },
            },
            { parent: this },
        );

        const userRole = this.createUserRole(name);
        this.createUserRoleBinding(userRole, 'orangelab:users');

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'tailscale-operator',
                namespace: namespace.metadata.name,
                version,
                repositoryOpts: {
                    repo: 'https://pkgs.tailscale.com/helmcharts',
                },
                values: {
                    oauth: {
                        clientId: oauthClientId,
                        clientSecret: oauthClientSecret,
                    },
                    apiServerProxyConfig: { mode: 'true' },
                    operatorConfig: {
                        hostname,
                        logging: 'debug', // info, debug, dev
                    },
                },
            },
            { parent: this },
        );
    }

    private createUserRoleBinding(userRole: ClusterRole, groupName: string) {
        new kubernetes.rbac.v1.ClusterRoleBinding(
            `${this.name}-user-cluster-role-binding`,
            {
                metadata: { name: 'orangelab-user' },
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
                metadata: { name: 'orangelab-user-cluster-role' },
                rules: [
                    {
                        apiGroups: [
                            '',
                            'apiextensions',
                            'apps',
                            'autoscaling',
                            'batch',
                            'coordination.k8s.io',
                            'discovery.k8s.io',
                            'extensions',
                            'metrics.k8s.io',
                            'networking.k8s.io',
                            'node.k8s.io',
                            'policy',
                            'rbac.authorization.k8s.io',
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
