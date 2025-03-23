import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export class AmdGPU extends pulumi.ComponentResource {
    constructor(name: string, args = {}, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:AmdGPU', name, args, opts);

        const config = new pulumi.Config(name);
        const app = new Application(this, name);

        new kubernetes.helm.v4.Chart(
            name,
            {
                chart: 'amd-gpu',
                namespace: app.namespace,
                version: config.get('version'),
                repositoryOpts: { repo: 'https://rocm.github.io/k8s-device-plugin/' },
                values: {
                    node_selector_enabled: true,
                    node_selector: {
                        'feature.node.kubernetes.io/pci-0300_1002.present': null,
                        'orangelab/gpu': 'amd',
                    },
                    securityContext: {
                        allowPrivilegeEscalation: true,
                        privileged: true,
                    },
                    labeller: {
                        enabled: true,
                    },
                },
            },
            { parent: this },
        );
    }
}
