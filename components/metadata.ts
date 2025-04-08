import * as pulumi from '@pulumi/pulumi';

export class Metadata {
    private config: pulumi.Config;
    private namespace: string;
    private labels: Record<string, string>;

    constructor(
        private appName: string,
        args: { namespace: string; config: pulumi.Config },
    ) {
        this.config = args.config;
        this.namespace = args.namespace;
        this.labels = this.createLabels();
    }

    get() {
        return {
            name: this.appName,
            namespace: this.namespace,
            labels: this.labels,
        };
    }

    getForComponent(name: string) {
        return {
            ...this.get(),
            name: `${this.appName}-${name}`,
            labels: this.createLabels(name),
        };
    }

    getSelectorLabels(component?: string) {
        const selectorLabels = { 'app.kubernetes.io/name': this.appName };
        return component
            ? { ...selectorLabels, 'app.kubernetes.io/component': component }
            : selectorLabels;
    }

    private createLabels(componentName?: string) {
        const labels: Record<string, string> = {
            'app.kubernetes.io/name': this.appName,
            'app.kubernetes.io/managed-by': 'OrangeLab',
            'app.kubernetes.io/component': componentName ?? 'default',
        };
        const version = this.config.get('version');
        const appVersion = this.config.get('appVersion');
        if (version) {
            labels['app.kubernetes.io/version'] = appVersion ?? version;
        }
        return labels;
    }
}
