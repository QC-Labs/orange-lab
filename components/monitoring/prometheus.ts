import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { PersistentStorage } from '../persistent-storage';

export interface PrometheusArgs {
    domainName: string;
}

export class Prometheus extends pulumi.ComponentResource {
    public readonly alertmanagerEndpointUrl: string | undefined;
    public readonly prometheusEndpointUrl: string | undefined;
    public readonly grafanaEndpointUrl: string | undefined;

    constructor(name: string, args: PrometheusArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:monitoring:Prometheus', name, args, opts);

        const config = new pulumi.Config('prometheus');
        const version = config.require('version');
        const grafanaPassword = config.require('grafana-password');
        const prometheusHostname = config.require('hostname-prometheus');
        const alertManagerHostname = config.require('hostname-alert-manager');
        const grafanaHostname = config.require('hostname-grafana');

        const namespace = new kubernetes.core.v1.Namespace(
            `${name}-ns`,
            {
                metadata: { name },
            },
            { parent: this },
        );

        const grafanaStorage = new PersistentStorage(
            `${name}-grafana-storage`,
            {
                name: `${name}-grafana`,
                namespace: namespace.metadata.name,
                size: '10Gi',
            },
            { parent: this },
        );

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'kube-prometheus-stack',
                version,
                namespace: namespace.metadata.name,
                repositoryOpts: {
                    repo: 'https://prometheus-community.github.io/helm-charts',
                },
                values: {
                    defaultRules: {
                        rules: { etcd: false },
                    },
                    grafana: {
                        adminPassword: grafanaPassword,
                        ingress: {
                            enabled: true,
                            ingressClassName: 'tailscale',
                            tls: [{ hosts: [grafanaHostname] }],
                            hostname: grafanaHostname,
                        },
                        persistence: {
                            enabled: true,
                            existingClaim: grafanaStorage.volumeClaimName,
                        },
                    },
                    kubeEtcd: { enabled: false },
                    kubeControllerManager: { serviceMonitor: { https: false } },
                    kubeScheduler: { serviceMonitor: { https: false } },
                    kubeProxy: { serviceMonitor: { https: false } },
                    alertmanager: {
                        enabled: false,
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
                                        storageClassName:
                                            PersistentStorage.getStorageClass(),
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
                                        storageClassName:
                                            PersistentStorage.getStorageClass(),
                                        accessModes: ['ReadWriteOnce'],
                                        resources: { requests: { storage: '50Gi' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            { parent: this },
        );

        this.alertmanagerEndpointUrl = `https://${alertManagerHostname}.${args.domainName}`;
        this.grafanaEndpointUrl = `https://${grafanaHostname}.${args.domainName}`;
        this.prometheusEndpointUrl = `https://${prometheusHostname}.${args.domainName}`;
    }
}
