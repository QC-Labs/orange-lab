import { Application, config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

export class Slskd extends pulumi.ComponentResource {
    public readonly app: Application;
    public readonly apiKey: pulumi.Output<string>;
    public readonly soulseekUsername: pulumi.Output<string>;
    public readonly soulseekPassword: pulumi.Output<string>;
    public readonly webPassword: pulumi.Output<string>;

    constructor(
        private name: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:media:Slskd', name, {}, opts);

        this.apiKey = config.getSecret(name, 'SLSKD_API_KEY') ?? this.createApiKey();
        this.soulseekUsername = pulumi.output(
            config.get(name, 'soulseek/username') ?? this.createSoulseekUsername(),
        );
        this.soulseekPassword =
            config.getSecret(name, 'soulseek/password') ?? this.createSoulseekPassword();
        this.webPassword =
            config.getSecret(this.name, 'web/password') ?? this.createWebPassword();

        this.app = new Application(this, name).addStorage().addLocalStorage({
            name: 'media',
            hostPath: config.require(this.name, 'media/hostPath'),
        });

        this.createDeployment();
    }

    private createApiKey() {
        return new random.RandomPassword(
            `${this.name}-api-key`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }

    private createWebPassword() {
        return new random.RandomPassword(
            `${this.name}-web-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }

    private createSoulseekUsername() {
        return new random.RandomPassword(
            `${this.name}-soulseek-username`,
            { length: 12, special: false },
            { parent: this },
        ).result;
    }

    private createSoulseekPassword() {
        return new random.RandomPassword(
            `${this.name}-soulseek-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }

    private createDeployment() {
        return this.app.addDeployment({
            ports: [
                { name: 'http', port: 5030 },
                { name: 'p2p', port: 50300, protocol: 'tcp' },
            ],
            volumeMounts: [{ mountPath: '/app' }, { mountPath: '/media', name: 'media' }],
            env: {
                SLSKD_DOWNLOADS_DIR: config.require(this.name, 'SLSKD_DOWNLOADS_DIR'),
                SLSKD_SHARED_DIR: config.require(this.name, 'SLSKD_SHARED_DIR'),
                SLSKD_REMOTE_CONFIGURATION: 'false',
            },
            envSecret: {
                SLSKD_DEBUG: this.app.debug ? 'True' : undefined,
                SLSKD_API_KEY: this.apiKey,
                SLSKD_USERNAME: 'slskd',
                SLSKD_PASSWORD: this.webPassword,
                SLSKD_SLSK_USERNAME: this.soulseekUsername,
                SLSKD_SLSK_PASSWORD: this.soulseekPassword,
            },
            resources: {
                requests: { memory: '64Mi' },
                limits: { memory: '256Mi' },
            },
            runAsUser: 1000,
            volumeOwnerUserId: 1000,
        });
    }
}
