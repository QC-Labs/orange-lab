import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { RustfsProvisioner } from './rustfs-provisioner';

export class Rustfs extends pulumi.ComponentResource {
    public readonly users: Record<string, pulumi.Output<string>> = {};
    public readonly s3Provisioner: RustfsProvisioner;

    app: Application;
    rootUser: string;
    hostname: string;
    hostnameApi: string;

    constructor(
        private name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Rustfs', name, {}, opts);

        this.hostname = config.require(name, 'hostname');
        this.hostnameApi = config.require(name, 'hostname-api');
        const dataPath = config.require(name, 'dataPath');
        const storageSize = config.require(name, 'storageSize');
        this.rootUser = config.require(name, 'rootUser');
        this.users = {
            [this.rootUser]: this.createPassword(),
        };

        this.app = new Application(this, name).addLocalStorage({
            name: 'data',
            hostPath: dataPath,
            size: storageSize,
        });
        this.createDeployment();
        this.s3Provisioner = new RustfsProvisioner(
            `${name}-admin`,
            {
                metadata: this.app.metadata,
                rootUser: this.rootUser,
                rootPassword: this.users[this.rootUser],
                s3EndpointUrl: this.app.network.clusterEndpoints[`${this.name}-console`],
            },
            { parent: this },
        );
    }

    private createDeployment() {
        const appVersion = config.require(this.name, 'appVersion');
        this.app.addDeployment({
            image: `rustfs/rustfs:${appVersion}`,
            volumeOwnerUserId: 10001,
            ports: [
                { name: 'console', port: 9001, hostname: this.hostname },
                { name: 'api', port: 9000, hostname: this.hostnameApi },
            ],
            env: {
                RUSTFS_ACCESS_KEY: this.rootUser,
                RUSTFS_CONSOLE_ENABLE: 'true',
                RUSTFS_SERVER_DOMAINS: this.app.network.getIngressInfo().hostname,
            },
            envSecret: {
                RUSTFS_SECRET_KEY: this.users[this.rootUser],
            },
            commandArgs: ['/data'],
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
