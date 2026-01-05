import * as pulumi from '@pulumi/pulumi';
import * as kubernetes from '@pulumi/kubernetes';
import { Application } from '../application';
import { rootConfig } from '../root-config';

export class Traefik extends pulumi.ComponentResource {
    private readonly crdsChart: kubernetes.helm.v3.Release;

    constructor(
        private name: string,
        args = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Traefik', name, args, opts);

        const app = new Application(this, name, { existingNamespace: 'kube-system' });

        this.crdsChart = this.createCRDs(app);
        if (rootConfig.isEnabled('traefik')) {
            this.createChart(app);
        }
    }

    private createCRDs(app: Application): kubernetes.helm.v3.Release {
        return app.addHelmChart(`${this.name}-crds`, {
            chart: 'traefik-crds',
            repo: 'https://traefik.github.io/charts',
            values: {
                deleteOnUninstall: true,
            },
        });
    }

    private createChart(app: Application): kubernetes.helm.v3.Release {
        return app.addHelmChart(
            this.name,
            {
                chart: 'traefik',
                repo: 'https://traefik.github.io/charts',
                skipCrds: true,
                values: {
                    affinity: app.nodes.getAffinity(),
                    ingressClass: {
                        enabled: true,
                        isDefaultClass: true,
                        name: 'traefik',
                    },
                    priorityClassName: 'system-cluster-critical',
                    tolerations: [
                        {
                            key: 'CriticalAddonsOnly',
                            operator: 'Exists',
                        },
                        {
                            key: 'node-role.kubernetes.io/control-plane',
                            operator: 'Exists',
                            effect: 'NoSchedule',
                        },
                        {
                            key: 'node-role.kubernetes.io/master',
                            operator: 'Exists',
                            effect: 'NoSchedule',
                        },
                    ],
                    service: {
                        ipFamilyPolicy: 'PreferDualStack',
                    },
                    ports: {
                        web: {
                            redirections: {
                                entryPoint: {
                                    to: 'websecure',
                                    scheme: 'https',
                                    permanent: true,
                                },
                            },
                        },
                    },
                    api: {
                        dashboard: true,
                    },
                },
            },
            { dependsOn: [this.crdsChart] },
        );
    }
}
