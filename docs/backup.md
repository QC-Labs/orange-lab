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

## Configure Longhorn

Longhorn uses several settings to control backup behavior:

| Setting                       | Description               | Default                       |
| ----------------------------- | ------------------------- | ----------------------------- |
| `longhorn:backupEnabled`      | Enable automatic backups  | `false`                       |
| `longhorn:backupAllVolumes`   | Backup all volumes        | `false`                       |
| `longhorn:snapshotCron`       | Schedule for snapshots    | `0 * * * *` (hourly)          |
| `longhorn:backupCron`         | Schedule for backups      | `15 0 * * *` (daily at 00:15) |
| `longhorn:backupFullInterval` | Days between full backups | `7` (weekly)                  |

```sh
# Enable automated backups
pulumi config set longhorn:backupEnabled true

# Enable backups for all volumes (optional, default is off)
pulumi config set longhorn:backupAllVolumes true

pulumi up
```

## Managing Volume Backups

When `longhorn:backupAllVolumes` is disabled (default), you must manually add volumes to the backup group.

### Adding Volumes to Backup Group via UI

1. Navigate to Longhorn UI at `https://longhorn.<tsnet>.ts.net/`
2. Select the desired volume from the list
3. Click "Recurring Jobs Schedule"
4. Add the volume to the "backup" group

### Adding Volumes to Backup Group via kubectl

```sh
# Add a volume to the backup group
kubectl -n longhorn-system label volume/<VOLUME-NAME> recurring-job-group.longhorn.io/backup=enabled
```
