import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { Nodes } from '@orangelab/nodes';
import { config } from '@orangelab/config';

export class Prometheus extends pulumi.ComponentResource {
    public readonly alertmanagerEndpointUrl: string | undefined;
    public readonly prometheusEndpointUrl: string | undefined;
    public readonly grafanaEndpointUrl: string | undefined;

    private readonly nodes: Nodes;
    private readonly app: Application;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:monitoring:Prometheus', name, {}, opts);

        this.nodes = new Nodes({ appName: name });
        const grafanaPassword = config.require(name, 'grafana/password');
        const prometheusHostname = config.require(name, 'hostname');
        const alertManagerHostname = config.require(name, 'alertmanager/hostname');
        const grafanaHostname = config.require(name, 'grafana/hostname');

        this.app = new Application(this, name)
            .addStorage({
                overrideFullname: `prometheus-${name}-db-prometheus-${name}-0`,
            })
            .addStorage({ name: 'grafana' })
            .addStorage({
                name: 'alertmanager',
                overrideFullname: `alertmanager-${name}-db-alertmanager-${name}-0`,
            });

        if (this.app.storageOnly) return;
        const grafanaIngres = this.app.network.getIngressInfo(grafanaHostname);
        const prometheusIngres = this.app.network.getIngressInfo(prometheusHostname);
        const alertManagerIngres = this.app.network.getIngressInfo(alertManagerHostname);
        this.app.addHelmChart(
            name,
            {
                chart: 'kube-prometheus-stack',
                repo: 'https://prometheus-community.github.io/helm-charts',
                values: {
                    alertmanager: {
                        enabled: true,
                        alertmanagerSpec: {
                            affinity: this.nodes.getAffinity(),
                            storage: {
                                volumeClaimTemplate:
                                    this.createVolumeClaimTemplate('alertmanager'),
                            },
                        },
                        ingress: {
                            enabled: true,
                            hosts: [alertManagerIngres.hostname],
                            ingressClassName: alertManagerIngres.className,
                            tls: [{ hosts: [alertManagerIngres.hostname] }],
                        },
                        replicas: 1,
                    },
                    cleanPrometheusOperatorObjectNames: true,
                    coreDns: { enabled: true },
                    defaultRules: { rules: { etcd: false } },
                    fullnameOverride: name,
                    grafana: {
                        enabled: true,
                        adminPassword: grafanaPassword,
                        affinity: this.nodes.getAffinity(),
                        ingress: {
                            enabled: true,
                            hosts: [grafanaIngres.hostname],
                            ingressClassName: grafanaIngres.className,
                            tls: [{ hosts: [grafanaIngres.hostname] }],
                        },
                        persistence: {
                            enabled: true,
                            existingClaim: this.app.storage?.getClaimName('grafana'),
                        },
                    },
                    'kube-state-metrics': { affinity: this.nodes.getAffinity() },
                    kubeApiServer: { enabled: true },
                    kubeControllerManager: {
                        enabled: true,
                        serviceMonitor: { https: false },
                    },
                    kubeDns: { enabled: false },
                    kubeEtcd: { enabled: false },
                    kubeProxy: { enabled: true, serviceMonitor: { https: false } },
                    kubeScheduler: { serviceMonitor: { https: false } },
                    kubeStateMetrics: { enabled: true },
                    kubelet: { enabled: true, serviceMonitor: { https: false } },
                    nodeExporter: { enabled: true },
                    prometheus: {
                        enabled: true,
                        ingress: {
                            enabled: true,
                            hosts: [prometheusIngres.hostname],
                            ingressClassName: prometheusIngres.className,
                            tls: [{ hosts: [prometheusIngres.hostname] }],
                        },
                        prometheusSpec: {
                            affinity: this.nodes.getAffinity(),
                            podMonitorSelectorNilUsesHelmValues: false,
                            probeSelectorNilUsesHelmValues: false,
                            ruleSelectorNilUsesHelmValues: false,
                            serviceMonitorSelectorNilUsesHelmValues: false,
                            storageSpec: {
                                volumeClaimTemplate: this.createVolumeClaimTemplate(),
                            },
                        },
                    },
                    'prometheus-node-exporter': { affinity: this.nodes.getAffinity() },
                    prometheusOperator: {
                        enabled: true,
                        affinity: this.nodes.getAffinity(),
                        tls: { enabled: false },
                    },
                },
            },
            { dependsOn: this.app.storage },
        );

        this.alertmanagerEndpointUrl = alertManagerIngres.url;
        this.grafanaEndpointUrl = grafanaIngres.url;
        this.prometheusEndpointUrl = prometheusIngres.url;
    }

    // https://github.com/prometheus-operator/prometheus-operator/blob/main/Documentation/platform/storage.md
    private createVolumeClaimTemplate(componentName?: string) {
        return {
            spec: this.app.storage?.isDynamic(componentName)
                ? { storageClassName: this.app.storage.getStorageClass(componentName) }
                : {
                      selector: {
                          matchLabels: {
                              'app.kubernetes.io/name': 'prometheus',
                              'app.kubernetes.io/component': componentName ?? 'default',
                          },
                      },
                  },
        };
    }
}
