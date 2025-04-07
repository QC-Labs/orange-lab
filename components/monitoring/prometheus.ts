import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { Nodes } from '../nodes';
import { PersistentStorage } from '../persistent-storage';

export interface PrometheusArgs {
    domainName: string;
}

export class Prometheus extends pulumi.ComponentResource {
    public readonly alertmanagerEndpointUrl: string | undefined;
    public readonly prometheusEndpointUrl: string | undefined;
    public readonly grafanaEndpointUrl: string | undefined;

    private readonly config: pulumi.Config;
    private readonly nodes: Nodes;
    private readonly app: Application;

    constructor(name: string, args: PrometheusArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:monitoring:Prometheus', name, args, opts);

        this.config = new pulumi.Config('prometheus');
        this.nodes = new Nodes({ config: this.config });
        const version = this.config.get('version');
        const grafanaPassword = this.config.require('grafana/password');
        const prometheusHostname = this.config.require('hostname');
        const alertManagerHostname = this.config.require('alertmanager/hostname');
        const grafanaHostname = this.config.require('grafana/hostname');

        this.app = new Application(this, name, {
            domainName: args.domainName,
        });

        this.app.addStorage({ name: 'grafana', size: '10Gi' });
        
        if (this.app.storageOnly) return;

        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'kube-prometheus-stack',
                version,
                namespace: this.app.namespace,
                repositoryOpts: {
                    repo: 'https://prometheus-community.github.io/helm-charts',
                },
                values: {
                    alertmanager: {
                        alertmanagerSpec: {
                            affinity: this.nodes.getAffinity(),
                            storage: {
                                volumeClaimTemplate: {
                                    spec: {
                                        accessModes: ['ReadWriteOnce'],
                                        resources: { requests: { storage: '5Gi' } },
                                        storageClassName:
                                            PersistentStorage.getStorageClass(),
                                    },
                                },
                            },
                        },
                        enabled: false,
                        ingress: {
                            enabled: true,
                            hostname: alertManagerHostname,
                            ingressClassName: 'tailscale',
                            tls: [{ hosts: [alertManagerHostname] }],
                        },
                    },
                    defaultRules: {
                        rules: { etcd: false },
                    },
                    grafana: {
                        adminPassword: grafanaPassword,
                        affinity: this.nodes.getAffinity(),
                        ingress: {
                            enabled: true,
                            hostname: grafanaHostname,
                            ingressClassName: 'tailscale',
                            tls: [{ hosts: [grafanaHostname] }],
                        },
                        persistence: {
                            enabled: true,
                            existingClaim: this.app.volumes.getClaimName('grafana'),
                        },
                    },
                    kubeControllerManager: { serviceMonitor: { https: false } },
                    kubeEtcd: { enabled: false },
                    kubeProxy: { serviceMonitor: { https: false } },
                    kubeScheduler: { serviceMonitor: { https: false } },
                    kubeStateMetrics: {
                        affinity: this.nodes.getAffinity(),
                    },
                    prometheus: {
                        ingress: {
                            enabled: true,
                            hostname: prometheusHostname,
                            ingressClassName: 'tailscale',
                            tls: [{ hosts: [prometheusHostname] }],
                        },
                        prometheusSpec: {
                            affinity: this.nodes.getAffinity(),
                            podMonitorSelectorNilUsesHelmValues: false,
                            probeSelectorNilUsesHelmValues: false,
                            ruleSelectorNilUsesHelmValues: false,
                            serviceMonitorSelectorNilUsesHelmValues: false,
                            storageSpec: {
                                volumeClaimTemplate: {
                                    spec: {
                                        accessModes: ['ReadWriteOnce'],
                                        resources: { requests: { storage: '50Gi' } },
                                        storageClassName:
                                            PersistentStorage.getStorageClass(),
                                    },
                                },
                            },
                        },
                    },
                    'prometheus-node-exporter': {
                        affinity: this.nodes.getAffinity(),
                    },
                    prometheusOperator: {
                        affinity: this.nodes.getAffinity(),
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
