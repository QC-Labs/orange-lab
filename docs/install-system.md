# Installation - system applications

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

Create OAuth client for tailscale-operator with write permissions to devices.
https://tailscale.com/learn/managing-access-to-kubernetes-with-tailscale#preparing-the-operator

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

Endpoint: `https://longhorn.<tsnet>.ts.net/`

Longhorn adds permanent storage that is replicated across multiple nodes. It also supports snapshots and backups of data volumes. The nodes need to be labeled with `orangelab/storage=true` - you need at least one.

It's a core component and required for most installations but if you run the cluster on a single node (let's say just to run Ollama), then you can leave it disabled and use k3s default `local-path-provisioner` as Longhorn adds some overhead and extra containers to the cluster.

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

Homepage - https://nvidia.github.io/gpu-operator/

Versions - https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/platform-support.html

Helm chart - https://github.com/NVIDIA/gpu-operator/blob/main/deployments/gpu-operator/

## Prometheus

Homepage - https://prometheus.io/

Helm chart - https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack

Endpoints:

-   `https://grafana.<tsnet>.ts.net/`
-   `https://prometheus.<tsnet>.ts.net/`
-   `https://alertmanager.<tsnet>.ts.net/`

Prometheus monitoring is disabled by default to keep resource usage low.

Enabling it will increase traffic between nodes and deploy components to all nodes but is useful for troubleshooting the cluster.

```sh
pulumi config set orangelab:prometheus true

pulumi up
```
