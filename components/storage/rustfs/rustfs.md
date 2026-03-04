# Rustfs

|                   |                                                                                |
| ----------------- | ------------------------------------------------------------------------------ |
| Homepage          | https://rustfs.dev/                                                            |
| Source            | https://github.com/rustfs/rustfs/                                              |
| Docker image      | https://hub.docker.com/r/rustfs/rustfs                                         |
| Docker image (rc) | https://hub.docker.com/r/rustfs/rc                                             |
| Endpoints         | `https://rustfs.<domain>/` (console) <br> `https://rustfs-api.<domain>/` (api) |

Rustfs is a distributed object storage system compatible with Amazon S3, implemented in Rust.

It is used by Longhorn as a backup target when Minio is disabled. Minio runs by default, but if `minio:enabled` is set to `false`, Longhorn falls back to using RustFS for backups (see `components/system/index.ts`).

Files are stored on host disk outside of cluster so make sure it's deployed to a specific node with enough disk space.

Currently deployed to a single node only.

## Installation

```sh
pulumi config set rustfs:enabled true
# Run Rustfs on a specific node
pulumi config set rustfs:requiredNodeLabel kubernetes.io/hostname=my-server

# Required: host directory for data storage (must exist on the node)
pulumi config set rustfs:dataPath /mnt/my-usb-drive/rustfs-data

pulumi up
```

## CLI

RustFS provides the `rc` CLI tool for S3 operations:

```sh
# Create "rustfs" alias pointing to Rustfs server
export ACCESS_KEY=$(pulumi config get rustfs:rootUser)
export SECRET_KEY=$(pulumi stack output system --show-secrets | jq .rustfsUsers.admin -r)

rc alias set rustfs https://rustfs.<domain> $ACCESS_KEY $SECRET_KEY

# Test connection
rc ls rustfs
```
