import * as minio from '@pulumi/minio';
import * as pulumi from '@pulumi/pulumi';
import { MinioS3User } from './minio-s3-user';

export interface MinioS3BucketArgs {
    bucketName: string;
    createBucket?: boolean;
}

export class MinioS3Bucket extends pulumi.ComponentResource {
    private readonly policy: minio.IamPolicy;
    private readonly bucket: minio.S3Bucket;

    constructor(
        public name: string,
        private args: MinioS3BucketArgs,
        private opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:MinioS3Bucket', name, args, opts);
        this.bucket = args.createBucket
            ? new minio.S3Bucket(
                  `${name}-s3bucket`,
                  { bucket: args.bucketName },
                  { parent: this, provider: opts?.provider, retainOnDelete: true },
              )
            : minio.S3Bucket.get(
                  args.bucketName,
                  args.bucketName,
                  {},
                  { parent: this, provider: opts?.provider },
              );

        this.policy = this.createBucketPolicy(args.bucketName);
    }

    private createBucketPolicy(bucketName: string) {
        return new minio.IamPolicy(
            `${this.name}-policy`,
            {
                name: bucketName,
                policy: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Action: [
                                's3:PutObject',
                                's3:GetObject',
                                's3:ListBucket',
                                's3:DeleteObject',
                            ],
                            Resource: [
                                `arn:aws:s3:::${bucketName}`,
                                `arn:aws:s3:::${bucketName}/*`,
                            ],
                        },
                    ],
                }),
            },
            { parent: this, provider: this.opts?.provider },
        );
    }

    public grantReadWrite(s3User: MinioS3User): void {
        new minio.IamUserPolicyAttachment(
            `${this.name}-policy-attachment`,
            {
                policyName: this.policy.name,
                userName: s3User.username,
            },
            { parent: this, provider: this.opts?.provider, dependsOn: [s3User] },
        );
    }
}
