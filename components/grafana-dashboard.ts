import * as pulumi from '@pulumi/pulumi';
import * as grafana from '@pulumiverse/grafana';

interface GrafanaDashboardArgs {
    configJson: unknown;
}

export class GrafanaDashboard {
    static folder?: grafana.oss.Folder = undefined;

    constructor(
        private appName: string,
        private scope: pulumi.ComponentResource,
        args: GrafanaDashboardArgs,
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

    private createDashboard(configJson: unknown) {
        new grafana.oss.Dashboard(
            `${this.appName}-dashboard`,
            {
                folder: GrafanaDashboard.folder?.uid,
                configJson: JSON.stringify(configJson),
            },
            { parent: this.scope },
        );
    }
}
