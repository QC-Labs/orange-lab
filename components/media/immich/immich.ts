import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import { DatabaseConfig, HttpEndpointInfo, VolumeMount } from '@orangelab/types';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

export class Immich extends pulumi.ComponentResource {
    public readonly app: Application;
    public readonly jwtSecret: pulumi.Output<string>;
    public readonly dbConfig?: DatabaseConfig;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:Immich', name, {}, opts);

        this.jwtSecret = pulumi.output(
            config.get(name, 'JWT_SECRET') ?? this.createJwtSecret(),
        );

        this.app = new Application(this, name).addStorage().addPostgres().addRedis();
        this.dbConfig = this.app.databases?.getConfig();
        if (!this.dbConfig) throw new Error('Database not found');
        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();

        const mlEnabled = config.requireBoolean(this.name, 'machine-learning/enabled');
        if (mlEnabled) {
            this.app.addStorage({ name: 'machine-learning' });
        }

        this.createDeployment({
            httpEndpointInfo,
            dbConfig: this.dbConfig,
            mlEnabled,
        });
        if (mlEnabled) {
            this.createMlDeployment();
        }
    }

    private createDeployment(args: {
        httpEndpointInfo: HttpEndpointInfo;
        dbConfig: DatabaseConfig;
        mlEnabled: boolean;
    }) {
        const waitForDb = this.app.databases?.getWaitContainer();
        const redisConfig = this.app.databases?.getConfig('redis');
        if (!redisConfig) throw new Error('Redis not found');

        const volumeMounts: VolumeMount[] = [{ mountPath: '/data' }];
        const env: Record<string, pulumi.Input<string>> = {
            DB_DATABASE_NAME: args.dbConfig.database,
            DB_HOSTNAME: args.dbConfig.hostname,
            DB_PORT: pulumi.interpolate`${args.dbConfig.port}`,
            DB_USERNAME: args.dbConfig.username,
            IMMICH_LOG_LEVEL: this.app.debug ? 'debug' : 'log',
            IMMICH_MACHINE_LEARNING_ENABLED: args.mlEnabled.toString(),
            IMMICH_MACHINE_LEARNING_URL: 'http://immich-machine-learning:3003',
            IMMICH_PORT: '2283',
            IMMICH_TRUSTED_PROXIES: `${config.clusterCidr},${config.serviceCidr}`,
            REDIS_HOSTNAME: redisConfig.hostname,
        };

        const waitForRedis = this.app.databases?.getWaitContainer(redisConfig);
        return this.app.addDeployment({
            ports: [{ name: 'http', port: 2283 }],
            volumeMounts,
            env,
            envSecret: {
                DB_PASSWORD: args.dbConfig.password,
                JWT_SECRET: this.jwtSecret,
            },
            initContainers: [
                ...(waitForRedis ? [waitForRedis] : []),
                ...(waitForDb ? [waitForDb] : []),
            ],
            healthChecks: true,
            resources: {
                requests: { memory: '512Mi' },
                limits: { memory: '1Gi' },
            },
        });
    }

    private createMlDeployment() {
        this.app.addDeployment({
            name: 'machine-learning',
            ports: [{ name: 'http', port: 3003, private: true }],
            volumeMounts: [
                { mountPath: '/cache', name: `${this.name}-machine-learning` },
            ],
            env: {
                IMMICH_LOG_LEVEL: this.app.debug ? 'debug' : 'log',
                IMMICH_PORT: '3003',
            },
            healthChecks: true,
            resources: {
                requests: { memory: '512Mi' },
            },
        });
    }

    private createJwtSecret() {
        return new random.RandomPassword(
            `${this.name}-jwt-secret`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
