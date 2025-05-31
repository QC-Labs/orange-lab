import * as minio from '@pulumi/minio';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export interface MinioArgs {
    domainName: string;
}

export class Minio extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly s3ApiUrl?: pulumi.Output<string>;
    public readonly s3ApiClusterUrl?: pulumi.Output<string>;
    public readonly s3WebUrl?: pulumi.Output<string>;
    public readonly minioProvider: minio.Provider;

    constructor(name: string, args: MinioArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Minio', name, args, opts);

        const config = new pulumi.Config('minio');
        const hostname = config.require('hostname');
        const hostnameApi = config.require('hostname-api');
        const dataPath = config.require('dataPath');
        const rootUser = config.require('rootUser');
        const rootPassword = config.require('rootPassword');

        const app = new Application(this, name, { domainName: args.domainName })
            .addLocalStorage({ name: 'data', hostPath: dataPath })
            .addDeployment({
                image: 'quay.io/minio/minio',
                ports: [
                    { name: 'console', port: 9001, hostname },
                    { name: 'api', port: 9000, hostname: hostnameApi },
                ],
                env: {
                    MINIO_CONSOLE_TLS_ENABLE: 'off',
                    MINIO_ROOT_USER: rootUser,
                    MINIO_ROOT_PASSWORD: rootPassword,
                    MINIO_BROWSER_REDIRECT_URL: `https://${hostname}.${args.domainName}/`,
                },
                commandArgs: ['server', '/data', '--console-address', ':9001'],
                volumeMounts: [{ name: 'data', mountPath: '/data' }],
            });

        this.endpointUrl = app.endpointUrl;
        this.s3ApiClusterUrl = pulumi.interpolate`http://${name}.minio:9000`;
        this.s3ApiUrl = pulumi.interpolate`https://${hostnameApi}.${args.domainName}`;
        this.s3WebUrl = pulumi.interpolate`https://${hostname}.${args.domainName}`;

        this.minioProvider = new minio.Provider(
            `${name}-provider`,
            {
                minioServer: `${hostnameApi}.${args.domainName}:443`,
                minioUser: rootUser,
                minioPassword: rootPassword,
                minioSsl: true,
            },
            { parent: this },
        );
    }
}
