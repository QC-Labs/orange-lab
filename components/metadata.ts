import * as pulumi from '@pulumi/pulumi';
import * as crypto from 'crypto';
import { ConfigVolume } from './types';

export class Metadata {
    private config: pulumi.Config;
    private namespace: string;
    private annotations: Record<string, string> = {};

    constructor(
        private appName: string,
        args: { namespace: string; config: pulumi.Config },
    ) {
        this.config = args.config;
        this.namespace = args.namespace;
    }

    get(params?: { includeAnnotations?: boolean; component?: string }): {
        name: string;
        namespace: string;
        labels: Record<string, string>;
        annotations?: Record<string, string>;
    } {
        const meta: {
            name: string;
            namespace: string;
            labels: Record<string, string>;
            annotations?: Record<string, string>;
        } = {
            name: params?.component
                ? `${this.appName}-${params.component}`
                : this.appName,
            namespace: this.namespace,
            labels: this.createLabels(params?.component),
        };
        if (params?.includeAnnotations) {
            meta.annotations = this.annotations;
        }
        return meta;
    }
    /**
     * Adds a checksum/config annotation based on the given config volume's files.
     * This ensures deployments are restarted when config file contents change.
     */
    addConfigHash(configVolume: ConfigVolume) {
        // Sort keys for deterministic hash
        const sortedFiles = Object.keys(configVolume.files)
            .sort()
            .map(k => ({ k, v: configVolume.files[k] }));
        const str = JSON.stringify(sortedFiles);
        const hash = crypto.createHash('sha256').update(str).digest('hex');
        this.annotations['checksum/config'] = hash;
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
