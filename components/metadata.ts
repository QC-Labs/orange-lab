import * as pulumi from '@pulumi/pulumi';

export class Metadata {
    private config: pulumi.Config;
    private namespace: string;
    private annotations: Record<string, pulumi.Output<string>> = {};

    constructor(
        private appName: string,
        args: { namespace: string; config: pulumi.Config },
    ) {
        this.config = args.config;
        this.namespace = args.namespace;
    }

    get(params?: {
        component?: string;
        annotations?: Record<string, pulumi.Output<string> | undefined>;
    }): {
        name: string;
        namespace: string;
        labels: Record<string, string>;
        annotations?: Record<string, pulumi.Output<string>>;
    } {
        return {
            name: params?.component
                ? `${this.appName}-${params.component}`
                : this.appName,
            namespace: this.namespace,
            labels: this.createLabels(params?.component),
            annotations: this.removeUndefinedValues(params?.annotations),
        };
    }

    private removeUndefinedValues<T>(
        obj: Record<string, T | undefined> | undefined,
    ): Record<string, T> | undefined {
        if (!obj) return undefined;
        const filteredEntries = Object.entries(obj).filter(
            ([, value]) => value !== undefined,
        ) as [string, T][];
        return Object.fromEntries(filteredEntries);
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
