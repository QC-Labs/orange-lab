# Longhorn

|                         |                                                                     |
| ----------------------- | ------------------------------------------------------------------- |
| Homepage                | https://longhorn.io/                                                |
| Helm chart              | https://github.com/longhorn/longhorn/tree/master/chart              |
| Default values          | https://github.com/longhorn/longhorn/blob/master/chart/values.yaml  |
| StorageClass parameters | https://longhorn.io/docs/1.8.0/references/storage-class-parameters/ |
| Endpoints               | `https://longhorn.<tsnet>.ts.net/`                                  |

Longhorn adds permanent storage that is replicated across multiple nodes. It also supports snapshots and backups of data volumes. The nodes need to be labeled with `node-role.kubernetes.io/longhorn=true` - you need at least one. Volumes stored at `/var/lib/longhorn/`.

## Installation

Enable iSCSI service before deploying Longhorn.

```sh
# Enable iSCSI on each Longhorn node
systemctl enable iscsid.service --now
systemctl enable iscsid.socket --now

# Add tag to storage nodes that will be used by Longhorn
kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true

# Enable module
pulumi config set longhorn:enabled true

# Set replicaCount to 3 if you have 3+ storage nodes
pulumi config set longhorn:replicaCount 3

# increase size of storage from default 50Gi to 100Gi
pulumi config set longhorn:storageSize 100Gi

pulumi up

```

## Backups

Longhorn supports automated backups to S3-compatible storage (MinIO). For detailed instructions on setting up and using backups, see [Backup Guide](/docs/backup.md).

## Disable Longhorn

Longhorn requires Linux and works best with multiple nodes for replication.

For single-node deployments, non-Linux platforms (Windows, macOS), or systems with limited resources, see the [Disabling Longhorn Guide](/docs/longhorn-disable.md) for detailed instructions.

## Uninstall

https://artifacthub.io/packages/helm/longhorn/longhorn#uninstallation

Before you uninstall Longhorn you need to remove all apps/storage using Longhorn volumes.

```sh
# Disable uninstall protection
kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag

pulumi config set longhorn:enabled false
pulumi up
```
