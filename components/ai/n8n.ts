import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { Application } from '../application';
import { rootConfig } from '../root-config';
import { DatabaseConfig } from '../types';

export interface N8nArgs {
    ollamaUrl?: string;
}

export class N8n extends pulumi.ComponentResource {
    app: Application;
    encryptionKey: pulumi.Output<string>;
    postgresConfig: DatabaseConfig;

    constructor(private name: string, args: N8nArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:N8n', name, args, opts);

        const config = new pulumi.Config(name);
        const hostname = config.require('hostname');
        const debug = rootConfig.isDebugEnabled(name);
        this.encryptionKey = pulumi.output(
            config.get('N8N_ENCRYPTION_KEY') ?? this.createEncryptionKey(),
        );

        this.app = new Application(this, name).addStorage().addPostgres();
        this.postgresConfig = this.app.databases.getPostgresConfig();
        this.app.addDeployment({
            image: 'docker.n8n.io/n8nio/n8n',
            port: 5678,
            volumeMounts: [{ mountPath: '/home/node/.n8n' }],
            runAsUser: 1000,
            resources: {
                requests: { memory: '250Mi' },
                limits: { memory: '500Mi' },
            },
            env: {
                CREDENTIALS_OVERWRITE_DATA: args.ollamaUrl
                    ? `{"ollamaApi": {"baseUrl": "${args.ollamaUrl}"}}`
                    : undefined,
                DB_TYPE: 'postgresdb',
                N8N_DIAGNOSTICS_ENABLED: 'false',
                N8N_ENCRYPTION_KEY: this.encryptionKey,
                N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true',
                N8N_HOST: hostname,
                N8N_LOG_LEVEL: debug ? 'debug' : undefined,
                N8N_METRICS: rootConfig.enableMonitoring() ? 'true' : 'false',
                N8N_PORT: '5678',
                N8N_PROTOCOL: 'http',
                N8N_PROXY_HOPS: '1',
                N8N_SECURE_COOKIE: 'false',
            },
            envSecret: {
                DB_POSTGRESDB_DATABASE: this.postgresConfig.database,
                DB_POSTGRESDB_HOST: this.postgresConfig.hostname,
                DB_POSTGRESDB_PASSWORD: this.postgresConfig.password,
                DB_POSTGRESDB_USER: this.postgresConfig.username,
            },
        });
    }

    private createEncryptionKey() {
        return new random.RandomPassword(
            `${this.name}-encryption-key`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
