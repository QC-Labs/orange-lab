import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export interface MinioArgs {
    domainName: string;
}

export class Minio extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly s3Endpoint?: pulumi.Output<string>;
    public readonly s3ClusterEndpoint?: pulumi.Output<string>;

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
        this.s3ClusterEndpoint = pulumi.interpolate`http://${name}.minio:9000`;
        this.s3Endpoint = pulumi.interpolate`https://${hostnameApi}.${args.domainName}`;
    }
}
