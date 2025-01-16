# Installation - system applications

Core components required before any other apps can de deployed.

## Tailscale-operator

Homepage - https://tailscale.com/kubernetes-operator

Versions - https://tailscale.com/changelog

Default values - https://github.com/tailscale/tailscale/blob/main/cmd/k8s-operator/deploy/chart/values.yaml

Endpoint: `https://k8s.<tsnet>.ts.net/`

The operator manages Ingress endpoints and load balancers on Tailnet as well as adds Tailscale authenticated Kubernetes API endpoint.

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
pulumi config set orangelab:tailscale-operator true

pulumi up
```

### Kubernetes API access

After deploying the operator, you can use new endpoint for Kubernetes API, https://k8s.<tailnet>.ts.net

Permissions are managed in Tailscale so make sure you enable admin access to the cluster in your Tailscale ACLs:

```json
"grants": [{
    "src": ["autogroup:admin"],
    "dst": ["tag:k8s-operator"],
    "app": {
        "tailscale.com/cap/kubernetes": [{
            "impersonate": {
                "groups": ["system:masters"],
            },
        }],
    },
}]
```

From now on, instead of copying the admin `~/.kube/config` from K3S server, you can use:

```sh
tailscale configure kubeconfig k8s
```

## Longhorn

Homepage - https://longhorn.io/

Helm chart - https://github.com/longhorn/longhorn/tree/master/chart

Default values - https://github.com/longhorn/longhorn/blob/master/chart/values.yaml

StorageClass parameters - https://longhorn.io/docs/1.7.2/references/storage-class-parameters/

Endpoint: `https://longhorn.<tsnet>.ts.net/`

Longhorn adds permanent storage that is replicated across multiple nodes. It also supports snapshots and backups of data volumes. The nodes need to be labeled with `orangelab/storage=true` - you need at least one.

It's a core component and required for most installations but if you run the cluster on a single node (let's say just to run Ollama), then you can leave it disabled and use k3s default `local-path-provisioner` as Longhorn adds some overhead and extra containers to the cluster. When using the local provisioner, the persistent volumes will be stored in `/var/lib/rancher/k3s/storage`.

Enable iSCSI service before deploying Longhorn.

```sh
# Add tag to storage nodes that will be used by Longhorn
kubectl label nodes <node-name> orangelab/storage=true

# Enable iSCSI on each Longhorn node
systemctl enable iscsid.service --now
systemctl enable iscsid.socket --now

# Enable module
pulumi config set orangelab:longhorn true

# Set replicaCount to amount of storage nodes
# Longhorn default is 3 which the recommended for 3+ storage nodes
pulumi config set longhorn:replicaCount 2

pulumi up

```

### Uninstall

https://artifacthub.io/packages/helm/longhorn/longhorn#uninstallation

```sh
kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag
```

## NVIDIA GPU operator

Homepage - https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/

Helm chart - https://github.com/NVIDIA/gpu-operator/blob/main/deployments/gpu-operator/

Components - https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/platform-support.html#gpu-operator-component-matrix

```sh
# Label node(s) that should run GPU workloads
kubectl label nodes <node-name> orangelab/gpu=true

# enable GPU operator
pulumi config set orangelab:nvidia-gpu-operator true

pulumi up

```
