# Backup and Restore

Longhorn provides automated snapshots and backups of persistent volumes to S3-compatible storage (MinIO). This guide explains how to set up, configure, and use this functionality.

Backup behavior:

-   **Snapshots**: Taken hourly for all volumes (configurable with `longhorn:snapshotCron`)
-   **Incremental Backups**: Run daily at 00:15 (configurable with `longhorn:backupCron`)
-   **Full Backups**: Taken weekly (configurable with `longhorn:backupFullInterval`)
-   If a volume has no changes since the last backup, no data is transferred

## Setup S3 storage (MinIO)

Make sure MinIO is installed and functioning before enabling backups. See [MinIO installation instructions](/components/system/SYSTEM.md#minio-recommended) for details.

Now let's create an S3 Bucket for Longhorn backups:

1. Access the MinIO web interface at `https://minio.<tsnet>.ts.net/`
2. Create a new bucket named `backup-longhorn` (or your preferred name)
3. Create new access keys with the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "GrantLonghornBackupstoreAccess0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:DeleteObject"
            ],
            "Resource": ["arn:aws:s3:::backup-longhorn", "arn:aws:s3:::backup-longhorn/*"]
        }
    ]
}
```

Add the S3 access keys to Pulumi config:

```sh
# Store S3 credentials securely
pulumi config set longhorn:backupAccessKeyId <key_id> --secret
pulumi config set longhorn:backupAccessKeySecret <key_value> --secret

# (Optional) Customize S3 bucket name/path
pulumi config set longhorn:backupTarget s3://backup-longhorn@us-east-1/
```

## Managing Volume Backups

There are two ways to configure which volumes get backed up:

### Option 1: Back up all volumes

Enable automatic backups for all volumes in the cluster:

```sh
pulumi config set longhorn:backupEnabled true
pulumi config set longhorn:backupAllVolumes true

pulumi up
```

### Option 2: Back up specific application volumes

To enable backups for a specific application volume you need to add it to `backup` group.

You can manage groups in volume details -> Recurring Jobs Schedule -> Groups, however it's best to use `backupVolume` in Pulumi to make sure configuration is persisted.

```sh
pulumi config set longhorn:backupEnabled true
pulumi config set longhorn:backupAllVolumes false # default value

# Enable backups for a specific application's volumes
pulumi config set <app>:backupVolume true

pulumi up
```
