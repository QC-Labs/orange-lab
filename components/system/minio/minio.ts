import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import { MinioProvisioner } from './minio-provisioner';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

export class Minio extends pulumi.ComponentResource {
    public readonly users: Record<string, pulumi.Output<string>> = {};
    public readonly s3Provisioner: MinioProvisioner;
    app: Application;
    rootUser: string;
    hostname: string;
    hostnameApi: string;

    constructor(
        private name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Minio', name, {}, opts);

        this.hostname = config.require(name, 'hostname');
        this.hostnameApi = config.require(name, 'hostname-api');
        const dataPath = config.require(name, 'dataPath');
        const storageSize = config.require(name, 'storageSize');
        this.rootUser = config.require(name, 'rootUser');
        this.users = {
            [this.rootUser]: pulumi.output(this.createPassword()),
        };

        this.app = new Application(this, name).addLocalStorage({
            name: 'data',
            hostPath: dataPath,
            size: storageSize,
        });
        this.createDeployment();
        this.s3Provisioner = new MinioProvisioner(
            `${name}-admin`,
            {
                metadata: this.app.metadata,
                rootUser: this.rootUser,
                rootPassword: this.users[this.rootUser],
                s3EndpointUrl: this.app.network.clusterEndpoints[this.hostnameApi],
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
                MINIO_BROWSER_REDIRECT_URL: this.app.network.getIngressInfo().url,
            },
            envSecret: {
                MINIO_ROOT_PASSWORD: this.users[this.rootUser],
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
