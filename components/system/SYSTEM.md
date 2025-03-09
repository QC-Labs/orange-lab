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
# 3 storage nodes is the default
pulumi config set longhorn:replicaCount 2
pulumi up

# Label node(s) that should run GPU workloads
kubectl label nodes <node-name> orangelab/gpu=true
pulumi config set nvidia-gpu-operator:enabled true
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

# Set replicaCount to 1 or 2 if you have less then 3 storage nodes
pulumi config set longhorn:replicaCount 2

# increase size of storage from default 50Gi to 100Gi
pulumi config set longhorn:storageSize 100Gi

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

```sh
kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag
```

## NVIDIA GPU operator

|            |                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Homepage   | https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/                                                           |
| Helm chart | https://github.com/NVIDIA/gpu-operator/blob/main/deployments/gpu-operator/                                              |
| Components | https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/platform-support.html#gpu-operator-component-matrix |

This component is needed to run GPU workloads using NVidia devices.

Designate one or more nodes as GPU, then enable the operator.

```sh
# Label node(s) that should run GPU workloads
kubectl label nodes <node-name> orangelab/gpu=true

# enable GPU operator
pulumi config set nvidia-gpu-operator:enabled true

pulumi up

```

## Debug (experimental)

Utility containers for troubleshooting the cluster.

Available settings described in source code - [debug.ts](./debug.ts).

Generally keep it disabled but there are few cases when it's useful:

-   access a detached Longhorn volume (f.e. cloned or restored from backup)
-   access a snapshot of currently attached volume (when active pod doesn't have shell available)
-   copy volume contents to local folder
-   use export job to create archive with volume contents to USB drive
