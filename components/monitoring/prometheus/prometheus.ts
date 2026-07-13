import { Application, Nodes, config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import assert from 'node:assert';

export class Prometheus extends pulumi.ComponentResource {
    public readonly alertmanagerEndpointUrl: string | undefined;
    public readonly prometheusEndpointUrl: string | undefined;
    public readonly grafanaEndpointUrl: string | undefined;
    public readonly grafanaPassword: pulumi.Output<string>;

    private readonly nodes: Nodes;
    private readonly app: Application;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:monitoring:Prometheus', name, {}, opts);

        this.nodes = new Nodes({ appName: name });
        this.grafanaPassword =
            config.getSecret(name, 'grafana/password') ?? this.createPassword(name, 'grafana');
        const prometheusHostname = config.require(name, 'hostname');
        const alertManagerHostname = config.require(name, 'alertmanager/hostname');
        const grafanaHostname = config.require(name, 'grafana/hostname');

        this.app = new Application(this, name)
            .addStorage({
                createStorageClass: true,
                overrideFullname: `prometheus-${name}-db-prometheus-${name}-0`,
            })
            .addStorage({ name: 'grafana' })
            .addStorage({
                createStorageClass: true,
                name: 'alertmanager',
                overrideFullname: `alertmanager-${name}-db-alertmanager-${name}-0`,
            });

        if (this.app.storageOnly) return;
        const grafanaHttpEndpoint = this.app.network.getHttpEndpointInfo(grafanaHostname);
        const prometheusHttpEndpoint =
            this.app.network.getHttpEndpointInfo(prometheusHostname);
        const alertManagerHttpEndpoint =
            this.app.network.getHttpEndpointInfo(alertManagerHostname);
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
                            hosts: [alertManagerHttpEndpoint.hostname],
                            ingressClassName: alertManagerHttpEndpoint.className,
                            tls: [{ hosts: [alertManagerHttpEndpoint.hostname] }],
                        },
                        replicas: 1,
                    },
                    cleanPrometheusOperatorObjectNames: true,
                    coreDns: { enabled: true },
                    defaultRules: { rules: { etcd: false } },
                    fullnameOverride: name,
                    grafana: {
                        enabled: true,
                        adminPassword: this.grafanaPassword,
                        affinity: this.nodes.getAffinity(),
                        ingress: {
                            enabled: true,
                            hosts: [grafanaHttpEndpoint.hostname],
                            ingressClassName: grafanaHttpEndpoint.className,
                            tls: [{ hosts: [grafanaHttpEndpoint.hostname] }],
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
                    kubelet: {
                        enabled: true,
                        serviceMonitor: { https: true, insecureSkipVerify: true },
                    },
                    nodeExporter: { enabled: true },
                    prometheus: {
                        enabled: true,
                        ingress: {
                            enabled: true,
                            hosts: [prometheusHttpEndpoint.hostname],
                            ingressClassName: prometheusHttpEndpoint.className,
                            tls: [{ hosts: [prometheusHttpEndpoint.hostname] }],
                        },
                        prometheusSpec: {
                            affinity: this.nodes.getAffinity(),
                            hostNetwork: true,
                            dnsPolicy: 'ClusterFirstWithHostNet',
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

        this.alertmanagerEndpointUrl = alertManagerHttpEndpoint.url;
        this.grafanaEndpointUrl = grafanaHttpEndpoint.url;
        this.prometheusEndpointUrl = prometheusHttpEndpoint.url;
    }

    private createPassword(name: string, component: string) {
        return new random.RandomPassword(
            `${name}-${component}-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }

    // https://github.com/prometheus-operator/prometheus-operator/blob/main/Documentation/platform/storage.md
    private createVolumeClaimTemplate(componentName?: string) {
        const storage = this.app.storage;
        assert(storage, 'Storage not initialized');
        const isDynamic = storage.isDynamic(componentName);
        return {
            spec: {
                storageClassName: storage.getStorageClass(componentName),
                resources: { requests: { storage: storage.getStorageSize(componentName) } },
                ...(!isDynamic
                    ? {
                          selector: {
                              matchLabels: {
                                  'app.kubernetes.io/name': 'prometheus',
                                  'app.kubernetes.io/component': componentName ?? 'default',
                              },
                          },
                      }
                    : {}),
            },
        };
    }
}
