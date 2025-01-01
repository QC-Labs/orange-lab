# Installation - system applications

## Tailscale-operator

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

Enable iSCSI service before deploying Longhorn.

```sh
# Add tag to storage nodes that will be used by Longhorn
kubectl label nodes <node-name> orangelab/storage=true

# Enable iSCSI on each Longhorn node
systemctl enable iscsid.service --now
systemctl enable iscsid.socket --now

# Enable module
pulumi config set orangelab:longhorn true
pulumi up

```

### Uninstall

https://artifacthub.io/packages/helm/longhorn/longhorn#uninstallation

```sh
kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag
```

## Prometheus

Prometheus monitoring is disabled by default to keep resource usage low.

Enabling it will increase traffic between nodes and deploy components to all nodes but is useful for troubleshooting the cluster.

```sh
pulumi config set orangelab:prometheus true
pulumi up
```
