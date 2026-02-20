# Storage

Distributed storage and S3-compatible object storage for the cluster.

## Quick Start

```sh
# Label storage nodes
kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true

# Enable Longhorn
pulumi config set longhorn:enabled true
pulumi up
```

## Components

- **[Longhorn](./longhorn/longhorn.md)** - Replicated block storage for Kubernetes workloads. Required for storage nodes.
- **[RustFS](./rustfs/rustfs.md)** - S3-compatible object storage for Longhorn backups.
- **[Minio](./minio/minio.md)** - (Deprecated) S3-compatible object storage. Replaced by Rustfs.

## Platform Support

Longhorn only runs on Linux. For MacOS/Windows or single-node setups, use local storage instead. See [single node guide](/docs/single-node.md).

## Backup Setup

To enable automatic backups to S3:

```sh
# 1. Enable RustFS for S3 storage
pulumi config set rustfs:enabled true
pulumi config set rustfs:hostname rustfs.orangelab.space
pulumi config set rustfs:hostname-api rustfs-api.orangelab.space
pulumi config set rustfs:dataPath /mnt/storage/rustfs
pulumi config set rustfs:storageSize 100Gi
pulumi config set rustfs:rootUser admin
pulumi up

# 2. Enable Longhorn backups
pulumi config set longhorn:backupEnabled true
pulumi config set longhorn:backupBucket longhorn-backups
pulumi up
```
