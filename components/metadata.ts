import * as pulumi from '@pulumi/pulumi';

export class Metadata {
    public namespace: string;
    private config: pulumi.Config;

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
            labels:
                this.removeUndefinedValues(this.createLabels(params?.component)) ?? {},
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
        return {
            'app.kubernetes.io/name': this.appName,
            'app.kubernetes.io/component': component ?? 'default',
        };
    }

    getAppLabels(componentName?: string) {
        const labels: Record<string, string | undefined> = {
            'app.kubernetes.io/name': this.appName,
            'app.kubernetes.io/managed-by': 'OrangeLab',
            'app.kubernetes.io/component': componentName ?? 'default',
        };
        return labels;
    }

    private createLabels(componentName?: string) {
        const labels: Record<string, string | undefined> = {
            'app.kubernetes.io/name': this.appName,
            'app.kubernetes.io/managed-by': 'OrangeLab',
            'app.kubernetes.io/component': componentName ?? 'default',
        };
        const version = this.config.get('version');
        const appVersion = this.config.get('appVersion');
        labels['app.kubernetes.io/version'] = appVersion ?? version;
        return labels;
    }
}
