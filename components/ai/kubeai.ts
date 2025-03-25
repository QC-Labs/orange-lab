import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { GrafanaDashboard } from '../grafana-dashboard';
import dashboardJson from './kubeai-dashboard-vllm.json';

export interface KubeAiArgs {
    domainName: string;
    enableMonitoring: boolean;
}

export class KubeAi extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    private readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(private name: string, args: KubeAiArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:KubeAi', name, args, opts);

        this.config = new pulumi.Config(name);
        const version = this.config.get('version');
        const hostname = this.config.require('hostname');
        const huggingfaceToken = this.config.getSecret('huggingfaceToken');
        const models = this.config.get('models')?.split(',') ?? [];

        this.app = new Application(this, name, { gpu: true });

        const kubeAi = new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'kubeai',
                namespace: this.app.namespace,
                version,
                repositoryOpts: { repo: 'https://www.kubeai.org' },
                values: {
                    affinity: this.app.nodes.getAffinity(),
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
                    modelServers: {
                        OLlama: {
                            images: {
                                'amd-gpu': 'ollama/ollama:rocm',
                            },
                        },
                    },
                    modelAutoscaling: { timeWindow: '30m' },
                    modelServerPods: {
                        // required for NVidia detection
                        securityContext: {
                            privileged: true,
                            allowPrivilegeEscalation: true,
                        },
                    },
                    ['open-webui']: { enabled: false },
                    resourceProfiles: {
                        nvidia: {
                            runtimeClassName: 'nvidia',
                            nodeSelector: {
                                'orangelab/gpu': 'true',
                                'nvidia.com/gpu.present': 'true',
                            },
                        },
                        amd: {
                            imageName: 'amd-gpu',
                            nodeSelector: {
                                'orangelab/gpu': 'amd',
                            },
                            limits: {
                                'amd.com/gpu': 1,
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
                namespace: this.app.namespace,
                version,
                repositoryOpts: { repo: 'https://www.kubeai.org' },
                values: { catalog: this.createModelCatalog(models) },
            },
            { parent: this, dependsOn: [kubeAi] },
        );

        if (args.enableMonitoring) {
            new GrafanaDashboard(name, this, { configJson: dashboardJson });
        }

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.kubeai/openai/v1`;
    }

    private createModelCatalog(models: string[]): Record<string, object> {
        const gfxVersion = this.config.require('HSA_OVERRIDE_GFX_VERSION');
        const modelProfiles = new Map<string, object>();
        modelProfiles.set('amd', {
            enabled: true,
            resourceProfile: 'amd:1',
            minReplicas: 0,
            env: { HSA_OVERRIDE_GFX_VERSION: gfxVersion },
        });
        modelProfiles.set('nvidia', {
            enabled: true,
            resourceProfile: 'nvidia:1',
            minReplicas: 0,
        });
        const modelList = models.map(model => {
            const [modelName, profile, minReplicas = 0] = model.split('/');
            const info = { ...modelProfiles.get(profile || 'nvidia'), minReplicas };
            return { [modelName]: info };
        });
        const catalog = Object.assign({}, ...modelList) as Record<string, object>;
        return catalog;
    }
}
