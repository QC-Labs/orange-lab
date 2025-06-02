import * as minio from '@pulumi/minio';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

export interface MinioS3UserArgs {
    username: string;
}

export class MinioS3User extends pulumi.ComponentResource {
    public readonly accessKey: pulumi.Output<string>;
    public readonly secretKey: pulumi.Output<string>;
    public readonly username: string;

    private readonly iamUser: minio.IamUser;
    private readonly serviceAccount: minio.IamServiceAccount;

    constructor(
        private name: string,
        private args: MinioS3UserArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:MinioS3User', name, args, opts);

        this.iamUser = new minio.IamUser(
            `${name}-iamuser`,
            {
                name: args.username,
                secret: this.createPassword(),
            },
            { parent: this, provider: opts?.provider },
        );

        this.serviceAccount = new minio.IamServiceAccount(
            `${name}-sa`,
            { targetUser: this.iamUser.name },
            { parent: this, provider: opts?.provider, ignoreChanges: ['policy'] },
        );

        this.username = args.username;
        this.accessKey = this.serviceAccount.accessKey;
        this.secretKey = this.serviceAccount.secretKey;
    }

    private createPassword() {
        return new random.RandomPassword(
            `${this.name}-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
