import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { PersistentStorageType } from '../persistent-storage';

export interface OllamaArgs {
    domainName: string;
}

export class Ollama extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly serviceUrl?: string;

    private readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(private name: string, args: OllamaArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Ollama', name, args, opts);

        this.config = new pulumi.Config(name);
        const hostname = this.config.require('hostname');

        this.app = new Application(this, name, {
            domainName: args.domainName,
            gpu: true,
        })
            .addDefaultLimits({ request: { cpu: '5m', memory: '3Gi' } })
            .addStorage({ type: PersistentStorageType.GPU });

        if (this.app.storageOnly) return;

        this.createHelmRelease(hostname);

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.ollama:11434`;
    }

    private createHelmRelease(hostname: string) {
        const amdGpu = this.config.requireBoolean('amd-gpu');
        const gfxVersion = this.config.get('HSA_OVERRIDE_GFX_VERSION');
        const amdTargets = this.config.get('HCC_AMDGPU_TARGETS');
        const extraEnv = [
            { name: 'OLLAMA_DEBUG', value: 'false' },
            { name: 'OLLAMA_KEEP_ALIVE', value: this.config.get('OLLAMA_KEEP_ALIVE') ?? '5m' },
            { name: 'OLLAMA_LOAD_TIMEOUT', value: '5m' },
            { name: 'OLLAMA_CONTEXT_LENGTH', value: this.config.get('OLLAMA_CONTEXT_LENGTH') ?? '2048' },
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
                    fullnameOverride: 'ollama',
                    securityContext: { privileged: true },
                    runtimeClassName: amdGpu ? undefined : 'nvidia',
                    extraEnv,
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
                    replicaCount: 1,
                    persistentVolume: {
                        enabled: true,
                        existingClaim: this.app.volumes.getClaimName(),
                    },
                    ingress: {
                        enabled: true,
                        className: 'tailscale',
                        hosts: [
                            {
                                host: hostname,
                                paths: [{ path: '/', pathType: 'Prefix' }],
                            },
                        ],
                        tls: [{ hosts: [hostname] }],
                    },
                },
            },
            { parent: this },
        );
    }
}
