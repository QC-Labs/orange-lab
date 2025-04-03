# Installation - system applications

Core components required before any other apps can de deployed.

Recommended setup/tldr:

```sh
# Add k8s and k8s-operator tags to Tailscale ACL
# Create OAuth client in Tailscale
pulumi config set tailscale-operator:oauthClientId <OAUTH_CLIENT_ID> --secret
pulumi config set tailscale-operator:oauthClientSecret <OAUTH_CLIENT_SECRET> --secret
pulumi config set tailscale-operator:enabled true
pulumi up

# Add tag to storage nodes that will be used by Longhorn
kubectl label nodes <node-name> orangelab/storage=true
pulumi config set longhorn:enabled true
pulumi up

# Enable NFD for automatic GPU detection
pulumi config set nfd:enabled true
# Enable NVIDIA GPUs driver
pulumi config set nvidia-gpu-operator:enabled true
# Enable AMD GPUs driver
pulumi config set amd-gpu-operator:enabled true
pulumi up
```

## Tailscale-operator

|                |                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------ |
| Homepage       | https://tailscale.com/kubernetes-operator                                                  |
| Versions       | https://tailscale.com/changelog                                                            |
| Default values | https://github.com/tailscale/tailscale/blob/main/cmd/k8s-operator/deploy/chart/values.yaml |
| Endpoints      | `https://k8s.<tsnet>.ts.net/`                                                              |

The operator manages cluster ingress endpoints on Tailnet as well as adds Tailscale authenticated Kubernetes API endpoint.

### Installation

Add `k8s-operator` and `k8s` tags to your Tailnet in ACLs (https://login.tailscale.com/admin/acls/file):

```json
"tagOwners": {
    "tag:k8s-operator": [],
    "tag:k8s":          ["tag:k8s-operator"],
}
```

Go to https://login.tailscale.com/admin/settings/oauth and create OAuth client for tailscale-operator with write permissions for `auth_keys, devices:core`

Details at: https://tailscale.com/learn/managing-access-to-kubernetes-with-tailscale#preparing-the-operator

```sh
pulumi config set tailscale-operator:oauthClientId <OAUTH_CLIENT_ID> --secret
pulumi config set tailscale-operator:oauthClientSecret <OAUTH_CLIENT_SECRET> --secret
pulumi config set tailscale-operator:enabled true

pulumi up
```

### Kubernetes API access (optional)

After deploying the operator, you can use new endpoint for Kubernetes API, `https://k8s.<tailnet>.ts.net` for non-admin users.

Add this grant to your Tailscale ACLs:

```json
"grants": [{
    "src": ["autogroup:member"],
    "dst": ["tag:k8s-operator"],
    "app": {
        "tailscale.com/cap/kubernetes": [{
            "impersonate": {
                "groups": ["orangelab:users"],
            },
        }],
    },
}]
```

To be able to connect to the cluster as a read-only user, generate `~/.kube/config` with:

```sh
tailscale configure kubeconfig k8s
```

## Longhorn

|                         |                                                                     |
| ----------------------- | ------------------------------------------------------------------- |
| Homepage                | https://longhorn.io/                                                |
| Helm chart              | https://github.com/longhorn/longhorn/tree/master/chart              |
| Default values          | https://github.com/longhorn/longhorn/blob/master/chart/values.yaml  |
| StorageClass parameters | https://longhorn.io/docs/1.8.0/references/storage-class-parameters/ |
| Endpoints               | `https://longhorn.<tsnet>.ts.net/`                                  |

Longhorn adds permanent storage that is replicated across multiple nodes. It also supports snapshots and backups of data volumes. The nodes need to be labeled with `orangelab/storage=true` - you need at least one. Volumes stored at `/var/lib/longhorn/`.

### Installation

Enable iSCSI service before deploying Longhorn.

```sh
# Enable iSCSI on each Longhorn node
systemctl enable iscsid.service --now
systemctl enable iscsid.socket --now

# Add tag to storage nodes that will be used by Longhorn
kubectl label nodes <node-name> orangelab/storage=true

# Enable module
pulumi config set longhorn:enabled true

# Set replicaCount to 3 if you have 3+ storage nodes
pulumi config set longhorn:replicaCount 3

# increase size of storage from default 50Gi to 100Gi
pulumi config set longhorn:storageSize 100Gi

pulumi up

```

### Backups

Longhorn supports automated backups to S3-compatible storage (MinIO). For detailed instructions on setting up and using backups, see [Backup Guide](/docs/backup.md).

```sh
# Enable backups based on schedule
pulumi config set longhorn:backupEnabled true

# (Optional) Enable automatic backups for all volumes
pulumi config set longhorn:backupAllVolumes true

# (Optional) or just enable backup for single app
pulumi config set ollama:backupVolume true

pulumi up
```

### Disable Longhorn (not recommended)

Longhorn requires Linux so when running Windows or MacOS you can disable it and use `local-path` storage class instead.
This is also useful when running a single-node cluster as Longhorn adds some overhead and extra containers. Note that disabling Longhorn will mean that replicated storage won't be available.

When using the local provisioner, the persistent volumes will be stored in `/var/lib/rancher/k3s/storage`.

On SELinux systems, if deployment fails due to directory creation permissions on `/var/lib/rancher/k3s/storage/` you can temporarily loosen SELinux restrictions with `sudo setenforce 0` and then set it back to `1` when completed.

To override the storage classes used run:

```sh
pulumi config set longhorn:enabled false
pulumi config set orangelab:storageClass local-path
pulumi config set orangelab:storageClass-gpu local-path
pulumi up
```

### Uninstall

https://artifacthub.io/packages/helm/longhorn/longhorn#uninstallation

Before you uninstall Longhorn you need to remove all apps/storage using Longhorn volumes.

```sh
# Disable uninstall protection
kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag

pulumi config set longhorn:enabled false
pulumi up
```

## Minio (Optional)

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

### Installation

```sh
pulumi config set minio:enabled true
# Run MinIO on a specific node
pulumi config set minio:requiredNodeLabel kubernetes.io/hostname=my-server

# (Optional) Modify filesystem folder for data
pulumi config set minio:dataPath /mnt/my-drive/minio-data

# (Recommended) Change root user credentials
pulumi config set minio:rootUser admin --secret
pulumi config set minio:rootPassword abcdef12345 --secret

pulumi up
```

## Cert-manager

|            |                            |
| ---------- | -------------------------- |
| Homepage   | https://cert-manager.io/   |
| Helm chart | https://charts.jetstack.io |

Cert-manager is a Kubernetes certificate management controller that automates the management and issuance of TLS certificates.

It is installed automatically when AMD GPU operator is enabled.

```sh
pulumi config set cert-manager:enabled true
pulumi up
```

### Uninstall

To uninstall cert-manager and clean up its custom resource definitions:

```sh
pulumi config set cert-manager:enabled false
pulumi up

kubectl delete crd \
  certificaterequests.cert-manager.io \
  certificates.cert-manager.io \
  challenges.acme.cert-manager.io \
  clusterissuers.cert-manager.io \
  issuers.cert-manager.io \
  orders.acme.cert-manager.io
```

## Node Feature Discovery (NFD)

|          |                                                           |
| -------- | --------------------------------------------------------- |
| Homepage | https://kubernetes-sigs.github.io/node-feature-discovery/ |
| GitHub   | https://github.com/kubernetes-sigs/node-feature-discovery |

Node Feature Discovery (NFD) is a Kubernetes add-on that detects and advertises hardware features and system configuration as node labels. It's used to detect nodes with GPU hardware installed.

### Installation

NFD is installed automatically when either NVIDIA or AMD GPU operators are enabled.

```sh
pulumi config set nfd:enabled true
pulumi up
```

### GPU node labels

Automatic detection of AMD and NVIDIA GPUs is enabled by default.

Nodes with GPUs will have the following labels added:

For NVIDIA GPUs:

-   `orangelab/gpu: "true"`
-   `orangelab/gpu-nvidia: "true"`

For AMD GPUs:

-   `orangelab/gpu: "true"`
-   `orangelab/gpu-amd: "true"`

These labels can be used for node selection in applications.

If there are some nodes with GPU that should not be used for GPU workloads, you can disable auto detection and remove related labels from the node.

```sh
# Disable automatic GPU detection
pulumi config set nfd:gpu-autodetect false
pulumi up

# Remove node labels
kubectl label nodes <node_name> orangelab/gpu-
kubectl label nodes <node_name> orangelab/gpu-nvidia-
kubectl label nodes <node_name> orangelab/gpu-amd-
```

### Uninstall

To uninstall NFD and clean up its custom resource definitions:

```sh
pulumi config set nfd:enabled false
pulumi up

kubectl delete crd \
  nodefeaturegroups.nfd.k8s-sigs.io \
  nodefeaturerules.nfd.k8s-sigs.io \
  nodefeatures.nfd.k8s-sigs.io
```

## NVIDIA GPU operator

|            |                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Homepage   | https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/                                                           |
| Helm chart | https://github.com/NVIDIA/gpu-operator/blob/main/deployments/gpu-operator/                                              |
| Components | https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/platform-support.html#gpu-operator-component-matrix |

This component is needed to run GPU workloads using NVidia devices.

Enable the NVIDIA GPU operator to support NVIDIA GPU workloads.

```sh
# Enable automatic GPU detection with NFD
pulumi config set nfd:enabled true

# Enable NVIDIA GPU operator
pulumi config set nvidia-gpu-operator:enabled true

pulumi up

```

## AMD GPU operator

|                  |                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------- |
| Homepage         | https://github.com/ROCm/gpu-operator                                                |
| Docs             | https://instinct.docs.amd.com/projects/gpu-operator                                 |
| Helm values      | https://github.com/ROCm/gpu-operator/blob/main/helm-charts/values.yaml              |
| DeviceConfig ref | https://instinct.docs.amd.com/projects/gpu-operator/en/latest/fulldeviceconfig.html |

This component is needed to run GPU workloads using AMD devices with ROCm support.

```sh
# Enable automatic GPU detection with NFD
pulumi config set nfd:enabled true

# Enable AMD GPU operator
pulumi config set amd-gpu-operator:enabled true

pulumi up
```

For applications like Ollama using AMD GPUs, you may need to set `amd-gpu` to true as the docker images used are different:

```sh
pulumi config set ollama:amd-gpu true
```

For detailed information, see the [AMD GPU Guide](/docs/amd-gpu.md).

### Uninstall

For detailed uninstallation instructions, see the [official documentation](https://instinct.docs.amd.com/projects/gpu-operator/en/latest/uninstallation/uninstallation.html).

```sh
pulumi config set amd-gpu-operator:enabled false
pulumi up

kubectl delete crds deviceconfigs.amd.com \
    modules.kmm.sigs.x-k8s.io \
    nodemodulesconfigs.kmm.sigs.x-k8s.io \
    preflightvalidations.kmm.sigs.x-k8s.io
```

## Debug (experimental)

Utility containers for troubleshooting the cluster.

Available settings described in source code - [debug.ts](./debug.ts).

Generally keep it disabled but there are few cases when it's useful:

-   access a detached Longhorn volume (f.e. cloned or restored from backup)
-   access a snapshot of currently attached volume (when active pod doesn't have shell available)
-   copy volume contents to local folder
-   use export job to create archive with volume contents to USB drive
