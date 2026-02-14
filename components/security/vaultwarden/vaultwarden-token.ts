import { config } from '@orangelab/config';
import { Metadata } from '@orangelab/metadata';
import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { Argon2Hash } from './argon2-hash';

export class VaultwardenToken extends pulumi.ComponentResource {
    public readonly plainToken: pulumi.Output<string>;
    public readonly secretResource: kubernetes.core.v1.Secret;

    constructor(
        private appName: string,
        private metadata: Metadata,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:security:VaultwardenToken', `${appName}-token`, {}, opts);
        const plainToken =
            config.getSecret(appName, 'adminToken') ?? this.createPlainToken(appName);

        const argon2Hash = new Argon2Hash(`${appName}-admin-hash`, plainToken, {
            parent: this,
        });
        const hashOutput = argon2Hash.hash;

        const secretResource = this.createSecret(plainToken, hashOutput);

        this.plainToken = plainToken;
        this.secretResource = secretResource;
    }

    private createSecret(
        plainToken: pulumi.Output<string>,
        hashOutput: pulumi.Output<string>,
    ) {
        return new kubernetes.core.v1.Secret(
            `${this.appName}-admin-token`,
            {
                metadata: this.metadata.get(),
                stringData: pulumi
                    .all([plainToken, hashOutput])
                    .apply(([plain, hash]) => ({
                        ADMIN_TOKEN_PLAIN: plain,
                        ADMIN_TOKEN_HASH: hash,
                    })),
            },
            { parent: this },
        );
    }

    private createPlainToken(appName: string): pulumi.Output<string> {
        return new random.RandomPassword(
            `${appName}-admin-token`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
