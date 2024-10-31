import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class Prometheus extends pulumi.ComponentResource {
    private readonly version: string;

    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:monitoring:Prometheus', name, args, opts);

        const config = new pulumi.Config('prometheus');
        this.version = config.require('version');

        // https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack
        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'kube-prometheus-stack',
                version: this.version,
                namespace: 'monitoring',
                createNamespace: true,
                repositoryOpts: {
                    repo: 'https://prometheus-community.github.io/helm-charts',
                },
                values: {
                    defaultRules: {
                        rules: {
                            etcd: false,
                        },
                    },
                    grafana: {
                        username: 'admin',
                        password: 'admin',
                    },
                    kubeEtcd: {
                        enabled: false,
                    },
                    kubeControllerManager: {
                        serviceMonitor: {
                            https: false,
                        },
                    },
                    kubeScheduler: {
                        serviceMonitor: {
                            https: false,
                        },
                    },
                    kubeProxy: {
                        serviceMonitor: {
                            https: false,
                        },
                    },
                    alertmanager: {
                        ingress: {
                            enabled: true,
                        },
                        alertmanagerSpec: {
                            storage: {
                                volumeClaimTemplate: {
                                    spec: {
                                        storageClassName: 'longhorn',
                                        accessModes: ['ReadWriteOnce'],
                                        resources: {
                                            requests: {
                                                storage: '5Gi',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    prometheus: {
                        ingress: {
                            enabled: true,
                        },
                        prometheusSpec: {
                            storageSpec: {
                                volumeClaimTemplate: {
                                    spec: {
                                        storageClassName: 'longhorn',
                                        accessModes: ['ReadWriteOnce'],
                                        resources: {
                                            requests: {
                                                storage: '5Gi',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            { parent: this },
        );

        this.registerOutputs();
    }
}
