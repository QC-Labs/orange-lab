import * as minio from '@pulumi/minio';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { Application } from '../../application';

export class Minio extends pulumi.ComponentResource {
    public readonly minioProvider: minio.Provider;
    public readonly users: Record<string, pulumi.Output<string>> = {};
    app: Application;
    config: pulumi.Config;
    rootUser: string;
    hostname: string;
    hostnameApi: string;

    constructor(
        private name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Minio', name, {}, opts);

        this.config = new pulumi.Config(name);
        this.hostname = this.config.require('hostname');
        this.hostnameApi = this.config.require('hostname-api');
        const dataPath = this.config.require('dataPath');
        this.rootUser = this.config.require('rootUser');
        this.users = {
            [this.rootUser]: pulumi.output(this.createPassword()),
        };

        this.app = new Application(this, name).addLocalStorage({
            name: 'data',
            hostPath: dataPath,
        });
        this.createDeployment();
        const apiIngress = this.app.network.getIngressInfo(this.hostnameApi);
        this.minioProvider = new minio.Provider(
            `${name}-provider`,
            {
                minioServer: apiIngress.hostname,
                minioUser: this.rootUser,
                minioPassword: this.users[this.rootUser],
                minioSsl: true,
            },
            { parent: this },
        );
    }

    private createDeployment() {
        this.app.addDeployment({
            image: 'quay.io/minio/minio',
            ports: [
                { name: 'console', port: 9001, hostname: this.hostname },
                { name: 'api', port: 9000, hostname: this.hostnameApi },
            ],
            env: {
                MINIO_CONSOLE_TLS_ENABLE: 'off',
                MINIO_ROOT_USER: this.rootUser,
                MINIO_ROOT_PASSWORD: this.users[this.rootUser],
                MINIO_BROWSER_REDIRECT_URL: this.app.network.getIngressInfo().url,
            },
            commandArgs: ['server', '/data', '--console-address', ':9001'],
            volumeMounts: [{ name: 'data', mountPath: '/data' }],
        });
    }

    private createPassword() {
        return new random.RandomPassword(
            `${this.name}-root-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
