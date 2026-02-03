# Minio

|              |                                                         |
| ------------ | ------------------------------------------------------- |
| Homepage     | https://min.io/                                         |
| Helm chart   | https://github.com/minio/minio/tree/master/chart        |
| MinIO client | https://min.io/docs/minio/linux/reference/minio-mc.html |
| Endpoints    | `https://minio.<tsnet>.ts.net/`                         |

Minio is a distributed object storage system compatible with Amazon S3.

It is used by Longhorn as a backup target.

Files are stored on host disk outside of cluster so make sure it's deployed to a specific node with enough disk space.

Currently deployed to a single node only. For high-availability setup use MinIO Operator instead.

## Installation

```sh
pulumi config set minio:enabled true
# Run MinIO on a specific node
pulumi config set minio:requiredNodeLabel kubernetes.io/hostname=my-server

# (Optional) Modify filesystem folder for data
pulumi config set minio:dataPath /mnt/my-drive/minio-data

pulumi up
```

## CLI

```sh
# Install mc CLI tool
brew install minio-mc

# Create "lab" alias pointing to MinIO server
export ACCESS_KEY=minioadmin
export SECRET_KEY=$(pulumi stack output system --show-secrets | jq .minioUsers.minioadmin -r)

mc alias set lab https://minio-api.<domain> $ACCESS_KEY $SECRET_KEY

# Test connection
mc admin info lab
```
