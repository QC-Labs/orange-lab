import { Metadata } from '@orangelab/metadata';
import { S3Provisioner } from '@orangelab/types';
import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

export interface MinioProvisionerArgs {
    metadata: Metadata;
    rootUser: pulumi.Input<string>;
    rootPassword: pulumi.Input<string>;
    s3EndpointUrl: pulumi.Input<string>;
}

export class MinioProvisioner extends pulumi.ComponentResource implements S3Provisioner {
    instanceName: string;

    constructor(
        private name: string,
        private args: MinioProvisionerArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:MinioProvisioner', name, args, opts);
        this.instanceName = args.metadata.get().name;
    }

    public create(args: { username: string; bucket: string }): {
        s3EndpointUrl: pulumi.Output<string>;
        accessKey: pulumi.Output<string>;
        secretKey: pulumi.Output<string>;
    } {
        const password = new random.RandomPassword(
            `${this.name}-${args.username}-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;

        const job = this.createJob(args.username, password, args.bucket);

        return {
            s3EndpointUrl: pulumi.output(this.args.s3EndpointUrl),
            accessKey: job.urn.apply(() => args.username),
            secretKey: pulumi.all([job.urn, password]).apply(([_, p]) => p),
        };
    }

    private createJob(
        username: string,
        password: pulumi.Output<string>,
        bucket: string,
    ): kubernetes.batch.v1.Job {
        const secret = new kubernetes.core.v1.Secret(
            `${this.name}-${username}-env`,
            {
                metadata: {
                    ...this.args.metadata.get({ component: username }),
                    name: `${this.name}-${username}-env`,
                },
                stringData: {
                    ROOT_PASSWORD: this.args.rootPassword,
                    USER_PASSWORD: password,
                },
            },
            { parent: this },
        );

        const configMap = this.createScript(username, bucket);

        return new kubernetes.batch.v1.Job(
            `${this.name}-${username}`,
            {
                metadata: {
                    ...this.args.metadata.get({ component: username }),
                    name: `${this.name}-${username}`,
                },
                spec: {
                    backoffLimit: 0,
                    activeDeadlineSeconds: 600,
                    template: {
                        spec: {
                            containers: [
                                {
                                    name: 'mc',
                                    image: 'minio/mc',
                                    command: ['sh', '/config/script.sh'],
                                    envFrom: [
                                        { secretRef: { name: secret.metadata.name } },
                                    ],
                                    volumeMounts: [
                                        { name: 'config', mountPath: '/config' },
                                    ],
                                },
                            ],
                            volumes: [
                                {
                                    name: 'config',
                                    configMap: { name: configMap.metadata.name },
                                },
                            ],
                            restartPolicy: 'Never',
                        },
                    },
                },
            },
            { parent: this },
        );
    }

    private createScript(username: string, bucket: string) {
        const connectCmd = pulumi.interpolate`mc alias set ${this.name} "${this.args.s3EndpointUrl}" "${this.args.rootUser}" "$ROOT_PASSWORD" --insecure`;
        const commands = [
            `mc admin user add ${this.name} ${username} "$USER_PASSWORD"`,
            `mc mb ${this.name}/${bucket} --ignore-existing`,
            `mc admin policy attach ${this.name} readwrite --user ${username}`,
        ];

        const script = pulumi
            .all([connectCmd, ...commands])
            .apply(([connect, ...cmds]) =>
                [
                    '#!/bin/sh',
                    'set -e',
                    '',
                    `echo 'Waiting for Minio to be ready...'`,
                    `until ${connect}; do`,
                    `  echo 'Minio not ready, retrying in 10 seconds...'`,
                    '  sleep 10',
                    `done`,
                    ...cmds.flatMap(cmd => ['', `echo '${cmd}'`, cmd]),
                ].join('\n'),
            );

        const configMap = new kubernetes.core.v1.ConfigMap(
            `${this.name}-${username}-script`,
            {
                metadata: {
                    ...this.args.metadata.get({ component: username }),
                    name: `${this.name}-${username}-script`,
                },
                data: { 'script.sh': script },
            },
            { parent: this },
        );
        return configMap;
    }
}
