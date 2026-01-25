# Backup and Restore

Longhorn provides automated snapshots and backups of persistent volumes to S3-compatible storage (MinIO). This guide explains how to set up, configure, and use this functionality.

Longhorn jobs:

- **Snapshots**: Taken hourly for all volumes (configurable with `longhorn:snapshotCron`)
- **Incremental Backups**: Run daily at 00:15 (configurable with `longhorn:backupCron`)
- If a volume has no changes since the last backup, no data is transferred

**Note:** Snapshots are disabled by default to save storage space. You can enable them with `longhorn:snapshotEnabled` to be able to revert storage to previous state. It's recommneded however to enable daily backups instead as a snapshot is also taked during backup operation.

Please refer to the official MinIO installation documentation for detailed instructions on setting up MinIO: [https://min.io/docs/minio/user-guide/install.html]

## Setup S3 storage (MinIO)

Make sure MinIO is installed and functioning before enabling backups. See [MinIO installation instructions](/components/system/minio/minio.md) for details.

```sh
# S3 bucket that will be used for backups. Default: backup-longhorn
pulumi config set longhorn:backupBucket backup-longhorn

# Enable backup functionality in Longhorn. MinIO has to be running.
pulumi config set longhorn:backupEnabled true
```

## Managing Volume Backups

You can configure which volumes to back up through two main approaches:

### Option 1: Back up all volumes by default

Enable automatic backups for all volumes in the cluster, with the ability to exclude specific volumes:

```sh
# Enable backup functionality
pulumi config set longhorn:backupEnabled true

# Back up all volumes by default
pulumi config set longhorn:backupAllVolumes true

# Optional: Exclude specific volumes from backup
pulumi config set <app>:backupVolume false

pulumi up
```

### Option 2: Back up only specific volumes

Only back up volumes that are explicitly configured for backup:

```sh
# Enable backup functionality
pulumi config set longhorn:backupEnabled true

# Don't back up volumes by default (this is the default setting)
pulumi config set longhorn:backupAllVolumes false

# Enable backup for specific application volumes
pulumi config set <app>:backupVolume true

pulumi up
```

The backup setting precedence is:

1. App-specific setting (`<app>:backupVolume`) if specified
2. Global setting (`longhorn:backupAllVolumes`) if no app-specific setting exists

## Restoring from Backup

To restore a volume from a backup, follow these steps:

1. Restore the volume through the Longhorn UI first
    - Name the volume after the application (e.g., "ollama")
2. Use the `fromVolume` parameter to attach the existing volume:

```sh
pulumi config set <app>:fromVolume "my-restored-volume"
pulumi up
```

This approach gives you better volume naming and allows you to verify the restore before attaching it to your application.
