import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class Prometheus extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:monitoring:Prometheus', name, args, opts);

        const config = new pulumi.Config('prometheus');
        const version = config.require('version');
        const prometheusHostname = config.require('hostname-prometheus');
        const alertManagerHostname = config.require('hostname-alert-manager');
        const grafanaHostname = config.require('hostname-grafana');

        // https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack
        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'kube-prometheus-stack',
                version,
                namespace: 'prometheus',
                createNamespace: true,
                repositoryOpts: {
                    repo: 'https://prometheus-community.github.io/helm-charts',
                },
                values: {
                    defaultRules: {
                        rules: { etcd: false },
                    },
                    grafana: {
                        adminPassword: 'admin',
                        ingress: {
                            enabled: true,
                            ingressClassName: 'tailscale',
                            tls: [{ hosts: [grafanaHostname] }],
                            hostname: grafanaHostname,
                        },
                    },
                    kubeEtcd: { enabled: false },
                    kubeControllerManager: { serviceMonitor: { https: false } },
                    kubeScheduler: { serviceMonitor: { https: false } },
                    kubeProxy: { serviceMonitor: { https: false } },
                    alertmanager: {
                        ingress: {
                            enabled: true,
                            ingressClassName: 'tailscale',
                            tls: [{ hosts: [alertManagerHostname] }],
                            hostname: alertManagerHostname,
                        },
                        alertmanagerSpec: {
                            storage: {
                                volumeClaimTemplate: {
                                    spec: {
                                        storageClassName: 'longhorn',
                                        accessModes: ['ReadWriteOnce'],
                                        resources: { requests: { storage: '5Gi' } },
                                    },
                                },
                            },
                        },
                    },
                    prometheus: {
                        ingress: {
                            enabled: true,
                            ingressClassName: 'tailscale',
                            tls: [{ hosts: [prometheusHostname] }],
                            hostname: prometheusHostname,
                        },
                        prometheusSpec: {
                            storageSpec: {
                                volumeClaimTemplate: {
                                    spec: {
                                        storageClassName: 'longhorn',
                                        accessModes: ['ReadWriteOnce'],
                                        resources: { requests: { storage: '5Gi' } },
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
