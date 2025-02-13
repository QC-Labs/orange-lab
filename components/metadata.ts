import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class Metadata {
    private config: pulumi.Config;
    private namespace: kubernetes.core.v1.Namespace;
    private labels: Record<string, string>;

    constructor(
        private appName: string,
        args: { namespace: kubernetes.core.v1.Namespace; config: pulumi.Config },
    ) {
        this.config = args.config;
        this.namespace = args.namespace;
        this.labels = this.createLabels();
    }

    get() {
        return {
            name: this.appName,
            namespace: this.namespace.metadata.name,
            labels: this.labels,
        };
    }

    getForComponent(name: string) {
        return {
            ...this.get(),
            name: `${this.appName}-${name}`,
            labels: this.createLabelsForComponent(name),
        };
    }

    getSelectorLabels(component?: string) {
        const selectorLabels = { app: this.appName };
        return component ? { ...selectorLabels, component } : selectorLabels;
    }

    private createLabels() {
        const labels: Record<string, string> = {
            app: this.appName,
            'app.kubernetes.io/name': this.appName,
            'app.kubernetes.io/managed-by': 'OrangeLab',
        };
        const version = this.config.get('version');
        const appVersion = this.config.get('appVersion');
        if (version) {
            labels['app.kubernetes.io/version'] = appVersion ?? version;
        }
        return labels;
    }

    private createLabelsForComponent(name: string) {
        return {
            ...this.labels,
            component: name,
            'app.kubernetes.io/component': name,
        };
    }
}
