import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';
import { IngressInfo } from '../network';

export class Ollama extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly serviceUrl?: string;

    private readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(private name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Ollama', name, {}, opts);

        this.config = new pulumi.Config(name);
        const hostname = this.config.require('hostname');

        this.app = new Application(this, name, { gpu: true })
            .addDefaultLimits({ request: { cpu: '5m', memory: '3Gi' } })
            .addStorage({ type: StorageType.GPU });

        if (this.app.storageOnly) return;

        const ingresInfo = this.app.network.getIngressInfo();
        this.createHelmRelease(ingresInfo);

        this.endpointUrl = ingresInfo.url;
        this.serviceUrl = `http://${hostname}.ollama:11434`;
    }

    private createHelmRelease(ingresInfo: IngressInfo) {
        const amdGpu = this.config.requireBoolean('amd-gpu');
        const gfxVersion = this.config.get('HSA_OVERRIDE_GFX_VERSION');
        const amdTargets = this.config.get('HCC_AMDGPU_TARGETS');
        const debug = this.config.getBoolean('debug') ?? false;
        const extraEnv = [
            { name: 'OLLAMA_DEBUG', value: debug ? 'true' : 'false' },
            {
                name: 'OLLAMA_KEEP_ALIVE',
                value: this.config.get('OLLAMA_KEEP_ALIVE') ?? '5m',
            },
            { name: 'OLLAMA_LOAD_TIMEOUT', value: '5m' },
            {
                name: 'OLLAMA_CONTEXT_LENGTH',
                value: this.config.get('OLLAMA_CONTEXT_LENGTH') ?? '2048',
            },
        ];
        if (amdGpu && gfxVersion) {
            extraEnv.push({
                name: 'HSA_OVERRIDE_GFX_VERSION',
                value: gfxVersion,
            });
        }
        if (amdGpu && amdTargets) {
            extraEnv.push({
                name: 'HCC_AMDGPU_TARGETS',
                value: amdTargets,
            });
        }
        new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'ollama',
                namespace: this.app.namespace,
                version: this.config.get('version'),
                repositoryOpts: { repo: 'https://otwld.github.io/ollama-helm/' },
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    extraEnv,
                    fullnameOverride: 'ollama',
                    ingress: {
                        enabled: true,
                        className: ingresInfo.className,
                        hosts: [
                            {
                                host: ingresInfo.hostname,
                                paths: [{ path: '/', pathType: 'Prefix' }],
                            },
                        ],
                        tls: [{ hosts: [ingresInfo.hostname] }],
                    },
                    ollama: {
                        gpu: {
                            enabled: true,
                            type: amdGpu ? 'amd' : 'nvidia',
                            number: 1,
                        },
                        models: {
                            run: this.config.get('models')?.split(',') ?? [],
                        },
                    },
                    persistentVolume: {
                        enabled: true,
                        existingClaim: this.app.storage.getClaimName(),
                    },
                    replicaCount: 1,
                    runtimeClassName: amdGpu ? undefined : 'nvidia',
                    securityContext: { privileged: true },
                },
            },
            { parent: this, dependsOn: this.app.storage },
        );
    }
}
