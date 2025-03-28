import * as pulumi from '@pulumi/pulumi';
import * as grafana from '@pulumiverse/grafana';

interface GrafanaJson {
    title: string;
}

interface GrafanaDashboardArgs {
    configJson: GrafanaJson;
    title?: string;
}

export class GrafanaDashboard {
    static folder?: grafana.oss.Folder = undefined;

    constructor(
        private appName: string,
        private scope: pulumi.ComponentResource,
        private args: GrafanaDashboardArgs,
    ) {
        GrafanaDashboard.folder = GrafanaDashboard.folder ?? this.createFolder();
        this.createDashboard(args.configJson);
    }

    private createFolder() {
        return new grafana.oss.Folder('grafana-folder', {
            title: 'OrangeLab',
            uid: 'orangelab',
        });
    }

    private createDashboard(configJson: GrafanaJson) {
        if (this.args.title) {
            configJson.title = this.args.title;
        }
        new grafana.oss.Dashboard(
            `${this.appName}-dashboard`,
            {
                folder: GrafanaDashboard.folder?.uid,
                configJson: JSON.stringify(configJson).replace(
                    /\${DS_PROMETHEUS}/g,
                    'Prometheus',
                ),
            },
            { parent: this.scope },
        );
    }
}
