import * as minio from '@pulumi/minio';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { Application } from '../../application';

export interface MinioArgs {
    domainName: string;
}

export class Minio extends pulumi.ComponentResource {
    public readonly minioProvider: minio.Provider;
    public readonly users: Record<string, pulumi.Output<string>> = {};
    app: Application;

    constructor(private name: string, args: MinioArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Minio', name, args, opts);

        const config = new pulumi.Config('minio');
        const hostname = config.require('hostname');
        const hostnameApi = config.require('hostname-api');
        const dataPath = config.require('dataPath');
        const rootUser = config.require('rootUser');
        this.users = {
            [rootUser]: pulumi.output(this.createPassword()),
        };

        this.app = new Application(this, name).addLocalStorage({
            name: 'data',
            hostPath: dataPath,
        });
        this.app.addDeployment({
            image: 'quay.io/minio/minio',
            ports: [
                { name: 'console', port: 9001, hostname },
                { name: 'api', port: 9000, hostname: hostnameApi },
            ],
            env: {
                MINIO_CONSOLE_TLS_ENABLE: 'off',
                MINIO_ROOT_USER: rootUser,
                MINIO_ROOT_PASSWORD: this.users[rootUser],
                MINIO_BROWSER_REDIRECT_URL: this.app.network.getIngressInfo().url,
            },
            commandArgs: ['server', '/data', '--console-address', ':9001'],
            volumeMounts: [{ name: 'data', mountPath: '/data' }],
        });
        this.minioProvider = new minio.Provider(
            `${name}-provider`,
            {
                minioServer: `${hostnameApi}.${rootConfig.tailnetDomain}:443`,
                minioUser: rootUser,
                minioPassword: this.users[rootUser],
                minioSsl: true,
            },
            { parent: this },
        );
    }

    private createPassword() {
        return new random.RandomPassword(
            `${this.name}-root-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
