import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { Dashboard } from '../dashboard';
import dashboardJson from './kubeai-dashboard-vllm.json';

export interface KubeAiArgs {
    domainName: string;
    enableMonitoring: boolean;
}

export class KubeAi extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    constructor(private name: string, args: KubeAiArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:KubeAi', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.get('version');
        const hostname = config.require('hostname');
        const huggingfaceToken = config.getSecret('huggingfaceToken');
        const models = config.get('models')?.split(',') ?? [];

        const app = new Application(this, name);

        const kubeAi = new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'kubeai',
                namespace: app.namespaceName,
                version,
                repositoryOpts: { repo: 'https://www.kubeai.org' },
                values: {
                    affinity: app.nodes.getAffinity(),
                    ingress: {
                        enabled: true,
                        className: 'tailscale',
                        rules: [
                            {
                                host: hostname,
                                paths: [
                                    { path: '/', pathType: 'ImplementationSpecific' },
                                ],
                            },
                        ],
                        tls: [{ hosts: [hostname] }],
                    },
                    metrics: args.enableMonitoring
                        ? {
                              prometheusOperator: {
                                  vLLMPodMonitor: {
                                      enabled: true,
                                      labels: {},
                                  },
                              },
                          }
                        : undefined,
                    modelAutoscaling: { timeWindow: '30m' },
                    modelServerPods: {
                        // required for NVidia detection
                        securityContext: {
                            privileged: true,
                            allowPrivilegeEscalation: true,
                        },
                    },
                    ['open-webui']: { enabled: false },
                    nodeSelector: { 'orangelab/gpu': 'true' },
                    resourceProfiles: {
                        nvidia: {
                            runtimeClassName: 'nvidia',
                            nodeSelector: {
                                'orangelab/gpu': 'true',
                                'nvidia.com/gpu.present': 'true',
                            },
                        },
                    },
                    secrets: { huggingface: { token: huggingfaceToken } },
                },
            },
            { parent: this },
        );

        new kubernetes.helm.v3.Release(
            `${name}-models`,
            {
                chart: 'models',
                namespace: app.namespaceName,
                version,
                repositoryOpts: { repo: 'https://www.kubeai.org' },
                values: {
                    catalog: this.createModelCatalog(models),
                },
            },
            { parent: this, dependsOn: [kubeAi] },
        );

        if (args.enableMonitoring) {
            new Dashboard(name, this, { configJson: dashboardJson });
        }

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.kubeai/openai/v1`;
    }

    private createModelCatalog(models: string[]): Record<string, object> {
        const modelList = models.map(model => ({
            [model]: {
                enabled: true,
                resourceProfile: 'nvidia:1',
                // model downloaded on first request
                minReplicas: 0,
            },
        }));
        const catalog = Object.assign({}, ...modelList) as Record<string, object>;
        return catalog;
    }
}
