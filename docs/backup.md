# Backup and Restore

Longhorn provides automated snapshots and backups of persistent volumes to S3-compatible storage (MinIO). This guide explains how to set up, configure, and use this functionality.

Backup behavior:

-   **Snapshots**: Taken hourly for all volumes (configurable with `longhorn:snapshotCron`)
-   **Incremental Backups**: Run daily at 00:15 (configurable with `longhorn:backupCron`)
    Please refer to the official MinIO installation documentation for detailed instructions on setting up MinIO: [https://min.io/docs/minio/user-guide/install.html]
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
pulumi config set longhorn:backupTarget s3://backup-longhorn@lab/
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

## Restoring from Backup

There are two ways to restore volumes from backups:

### Option 1: Using the `fromBackup` parameter

You can directly restore from a backup by providing the S3 URL in your application configuration:

```sh
pulumi config set <app>:fromBackup "s3://backup-longhorn@lab/?backup=backup-12345&volume=my-volume"
```

Notes:

-   The S3 URL must be copied exactly from the Longhorn UI's backup page
-   Navigate to Backup → select backup → Copy URL
-   Volumes are provisioned dynamically with system-generated names

### Option 2: Restore via UI then use `fromVolume` (Recommended)

For more control over the process and to get meaningful volume names:

1. Restore the volume through the Longhorn UI first
2. Use the `fromVolume` parameter to attach the existing volume:

```sh
# First, restore volume through Longhorn UI and note its name
pulumi config set <app>:fromVolume "my-restored-volume"
```

This approach gives you better volume naming and allows you to verify the restore before attaching it to your application.
