import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { IngressInfo } from '../../network';
import { StorageType } from '../../types';

export class Ollama extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly serviceUrl?: string;

    private readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(
        private name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:ai:Ollama', name, {}, opts);

        this.config = new pulumi.Config(name);
        const hostname = this.config.require('hostname');

        this.app = new Application(this, name, { gpu: true }).addStorage({
            type: StorageType.GPU,
        });

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
                value: this.config.require('OLLAMA_KEEP_ALIVE'),
            },
            { name: 'OLLAMA_LOAD_TIMEOUT', value: '5m' },
            {
                name: 'OLLAMA_CONTEXT_LENGTH',
                value: this.config.require('OLLAMA_CONTEXT_LENGTH'),
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
        let imageTag = this.config.get('appVersion');
        if (amdGpu && imageTag) imageTag = imageTag.concat('-rocm');
        this.app.addHelmChart(
            this.name,
            {
                chart: 'ollama',
                repo: 'https://otwld.github.io/ollama-helm/',
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    extraEnv,
                    fullnameOverride: 'ollama',
                    image: { tag: imageTag },
                    ingress: {
                        enabled: true,
                        className: ingresInfo.className,
                        hosts: [
                            {
                                host: ingresInfo.hostname,
                                paths: [{ path: '/', pathType: 'Prefix' }],
                            },
                        ],
                        tls: [
                            {
                                hosts: [ingresInfo.hostname],
                                secretName: ingresInfo.tlsSecretName,
                            },
                        ],
                        annotations: ingresInfo.annotations,
                    },
                    ollama: {
                        gpu: {
                            // AMD does not support time slicing so ignore resource requests and use device volumes instead
                            // appVersion has to be set to determine imageTag (Helm chart limitation)
                            enabled: !imageTag?.includes('-rocm'),
                            type: amdGpu ? 'amd' : 'nvidia',
                            number: 1,
                        },
                        models: {
                            run: this.config.get('models')?.split(',') ?? [],
                        },
                    },
                    ...(amdGpu
                        ? {
                              volumes: [
                                  {
                                      name: 'kfd',
                                      hostPath: { path: '/dev/kfd' },
                                  },
                                  {
                                      name: 'dri',
                                      hostPath: { path: '/dev/dri' },
                                  },
                              ],
                              volumeMounts: [
                                  { name: 'kfd', mountPath: '/dev/kfd' },
                                  { name: 'dri', mountPath: '/dev/dri' },
                              ],
                          }
                        : {}),
                    persistentVolume: {
                        enabled: true,
                        existingClaim: this.app.storage?.getClaimName(),
                    },
                    replicaCount: 1,
                    runtimeClassName: amdGpu ? undefined : 'nvidia',
                    securityContext: { privileged: true },
                },
            },
            { dependsOn: this.app.storage },
        );
    }
}
