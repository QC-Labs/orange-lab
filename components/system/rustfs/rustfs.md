# Rustfs

|           |                                                                                            |
| --------- | ------------------------------------------------------------------------------------------ |
| Homepage  | https://rustfs.dev/                                                                        |
| Source    | https://github.com/rustfs/rustfs/                                                          |
| Endpoints | `https://rustfs.<tsnet>.ts.net/` (console) <br> `https://rustfs-api.<tsnet>.ts.net/` (api) |

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

## Longhorn Backups

The automatic provisioner for Longhorn backup user is currently broken because `rustfs/rc` CLI doesn't support all required operations yet. Manual setup required:

### Fix Longhorn Backup User

The provisioner creates the `longhorn` user but cannot attach the required policy because rc CLI doesn't support policy operations yet.

**Steps:**

1. Get the password from the Kubernetes secret:

```sh
kubectl get secret longhorn-rustfs-backup -n longhorn-system -o jsonpath='{.data.AWS_SECRET_ACCESS_KEY}' | base64 -d
```

2. Open RustFS web console at `https://rustfs.<domain>/`

3. Log in with root credentials

4. Go to Users section

5. Delete the existing `longhorn` user (created by provisioner without policy)

6. Create new user with:
    - Username: `longhorn`
    - Password: (from step 1)
    - Policy: `readwrite`

The user is now ready for Longhorn backups.
