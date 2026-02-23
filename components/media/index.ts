import * as pulumi from '@pulumi/pulumi';
import { config } from '@orangelab/config';
import { Immich } from './immich/immich';

export class MediaModule extends pulumi.ComponentResource {
    private readonly immich?: Immich;

    getExports() {
        return {
            endpoints: {
                ...this.immich?.app.network.endpoints,
            },
            immich: this.immich
                ? {
                      jwtSecret: this.immich.jwtSecret,
                      db: this.immich.dbConfig,
                  }
                : undefined,
        };
    }

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super('orangelab:media', name, {}, opts);

        if (config.isEnabled('immich')) {
            this.immich = new Immich('immich', { parent: this });
        }
    }
}
