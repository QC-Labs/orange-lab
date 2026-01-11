# Installation - system applications

Core components required before any other apps can de deployed.

The first time you configure the cluster, it's best to run `pulumi up` after each component. Make sure all pods are running fine before moving to next step.

**Tailscale operator** used for internal HTTPS endpoints.

**Longhorn** required for storage nodes but only runs on Linux. You can use local storage when using MacOS, Windows or when running [single node](../../docs/single-node.md) only.

**MinIO** is used by Longhorn and required for automatic backups.

To run GPU workloads, either **NVidia or AMD operator** has to be installed.

**NFD** is used for automatic detection of nodes with GPU hardware.

**Cert-manager** is used to create SSL certificates when using custom domain and Traefik.

Recommended setup/tldr:

```sh
# Add k8s and k8s-operator tags to Tailscale ACL
# Create OAuth client in Tailscale
pulumi config set tailscale-operator:oauthClientId <OAUTH_CLIENT_ID> --secret
pulumi config set tailscale-operator:oauthClientSecret <OAUTH_CLIENT_SECRET> --secret
pulumi config set tailscale-operator:enabled true
pulumi up

# Add tag to storage nodes that will be used by Longhorn
kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true
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

## Custom domains

By default Tailscale domain (`*.ts.net`) is used for all services.

You can also setup your custom domain.

Note that Tailscale authentication does not work on custom domains.

You need to:

- add A record to your DNS pointing `*` (or each subdomain separately) to one of your Tailscale node IPs
- configure `cert-manager` to use `ClusterIssuer` to provision Let's Encrypt SSL certificates
- set `orangelab:customDomain` to the name of your domain

ServiceLB creates an endpoint on port 80/443 on each node in the cluster.

This could create issues if the ports are already used outside of OrangeLab. If you want to limit on which nodes the load balancer is created, label the nodes. Adding the first label switches ServiceLB to white-list only mode.

```sh
kubectl label node <node> svccontroller.k3s.cattle.io/enablelb=true
```

**Note:** When switching from Tailscale to a custom domain, you **must** disable `longhorn:backupEnabled` first. The MinIO Pulumi provider connection will break during the transition because the API endpoint hostname changes.

```sh
# Disable backups
# This will keep the S3 bucket contents intact
pulumi config set longhorn:backupEnabled false
pulumi up

# Enable custom domain, this will also install Traefik
pulumi config set orangelab:customDomain example.com
pulumi up

# Re-enable backups
pulumi config set longhorn:backupEnabled true
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

### Uninstall

```sh
pulumi config set tailscale-operator:enabled false
pulumi up

kubectl delete crd \
  connectors.tailscale.com \
  dnsconfigs.tailscale.com \
  proxyclasses.tailscale.com \
  proxygroups.tailscale.com \
  recorders.tailscale.com

kubectl delete clusterrole \
  tailscale-auth-proxy \
  tailscale-operator

kubectl delete clusterrolebinding \
  tailscale-auth-proxy \
  tailscale-operator

# This will remove all existing ingress instances using tailscale class
# They will be recreated once tailscale-operator is installed again
kubectl delete ingressclass tailscale
```

**Important:** Remove any leftover nodes with `tag:orangelab` at https://login.tailscale.com/admin/machines, otherwise Tailscale will create `<app>-1` entries and connections will fail.

## Traefik

|               |                                                                               |
| ------------- | ----------------------------------------------------------------------------- |
| Homepage      | https://traefik.io/                                                           |
| Helm chart    | https://github.com/traefik/traefik-helm-chart                                 |
| Values        | https://github.com/traefik/traefik-helm-chart/blob/master/traefik/values.yaml |
| Documentation | https://doc.traefik.io/traefik/                                               |
| Dashboard     | https://traefik.<domain>/                                                     |

Traefik is a cloud-native edge router that handles external HTTP/HTTPS traffic to cluster. It's installed automatically when `customDomain` is configured and serves as a ingress controller for custom domain services.

### Installation

```sh
# Set it to your domain, this installs Traefik CRDs even is Traefik is disabled
pulumi config set orangelab:customDomain example.com

# (Optional) Limit which nodes should run Traefik. By default all nodes
pulumi config set traefik:requiredNodeLabel: kubernetes.io/hostname=<host>

# (Optional) Change dashboard hostname
pulumi config set traefik:hostname traefik

pulumi up
```

### Uninstall

Traefik CRDs left intact when `customDomain` set but the pods can be removed temporarily if needed.

```sh
pulumi config set traefik:enabled false
pulumi up
```

## Longhorn

|                         |                                                                     |
| ----------------------- | ------------------------------------------------------------------- |
| Homepage                | https://longhorn.io/                                                |
| Helm chart              | https://github.com/longhorn/longhorn/tree/master/chart              |
| Default values          | https://github.com/longhorn/longhorn/blob/master/chart/values.yaml  |
| StorageClass parameters | https://longhorn.io/docs/1.8.0/references/storage-class-parameters/ |
| Endpoints               | `https://longhorn.<tsnet>.ts.net/`                                  |

Longhorn adds permanent storage that is replicated across multiple nodes. It also supports snapshots and backups of data volumes. The nodes need to be labeled with `node-role.kubernetes.io/longhorn=true` - you need at least one. Volumes stored at `/var/lib/longhorn/`.

### Installation

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

### Backups

Longhorn supports automated backups to S3-compatible storage (MinIO). For detailed instructions on setting up and using backups, see [Backup Guide](/docs/backup.md).

### Disable Longhorn

Longhorn requires Linux and works best with multiple nodes for replication.

For single-node deployments, non-Linux platforms (Windows, macOS), or systems with limited resources, see the [Disabling Longhorn Guide](/docs/longhorn-disable.md) for detailed instructions.

### Uninstall

https://artifacthub.io/packages/helm/longhorn/longhorn#uninstallation

Before you uninstall Longhorn you need to remove all apps/storage using Longhorn volumes.

```sh
# Disable uninstall protection
kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag

pulumi config set longhorn:enabled false
pulumi up
```

## Minio

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

### CLI

```sh
# Install mc CLI tool
brew install minio-mc

# Create "lab" alias pointing to MinIO server
export ACCESS_KEY=minioadmin
export SECRET_KEY=$(pulumi stack output system --show-secrets | jq .minioUsers.minioadmin -r)

mc alias set lab https://minio-api.serengeti-dragon.ts.net $ACCESS_KEY $SECRET_KEY

# Test connection
mc admin info lab
```

## Cert-manager

|                         |                                                        |
| ----------------------- | ------------------------------------------------------ |
| Homepage                | https://cert-manager.io/                               |
| Helm chart              | https://charts.jetstack.io                             |
| Supported DNS providers | https://cert-manager.io/docs/configuration/acme/dns01/ |

Cert-manager is a Kubernetes certificate management controller that automates the management and issuance of TLS certificates.

It is installed automatically when AMD GPU operator is enabled.

```sh
pulumi config set cert-manager:enabled true
pulumi up
```

### Custom domains

Cert-manager can be used to manage SSL certificates for your custom domain using Let's Encrypt.

You will need to create a `ClusterIssuer` depending on your DNS provider.

Currently only DNS challenges are supported, as HTTP require a public endpoint and at this point only private ones on Tailnet can be created.

You can find supported providers at https://cert-manager.io/docs/configuration/acme/dns01/

#### CloudFlare

For example, to use CloudFlare you need to create an API token (https://dash.cloudflare.com/profile/api-tokens) then create a `ClusterIssuer` using this token and DNS solver.

```sh
apiVersion: v1
kind: Secret
metadata:
    name: cloudflare-api-secret
    namespace: cert-manager
type: Opaque
stringData:
    api-token: <cloudflare_api_token>

---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
    name: letsencrypt-issuer # referenced in Pulumi.yaml, you can override it with cert-manager:clusterIssuer
    namespace: cert-manager
spec:
    acme:
        server: https://acme-staging-v02.api.letsencrypt.org/directory
        # server: https://acme-v02.api.letsencrypt.org/directory
        email: <valid_email>
        privateKeySecretRef:
            name: letsencrypt-account-key
        solvers:
            - dns01:
                  cloudflare:
                      apiTokenSecretRef:
                          name: cloudflare-api-secret
                          key: api-token
              selector:
                  dnsZones:
                      - <your_custom_domain_name>
```

Save this as `cloudflare.yml` replacing `cloudflare_api_token`, `valid_email` and `your_custom_domain_name`.

Use `kubectl apply -f cloudflare.yml` to create the issuer.

It's recommended to start with `acme-staging-v02` server to make sure everything works as expected, then switch to production `acme-v02` server to generate valid certificates. This helps to avoid getting throttled when configuration is incorrect.

More information at https://cert-manager.io/docs/configuration/acme/dns01/cloudflare/

Note the examples use `Issuer` which is namespace scoped but we'll use `ClusterIssuer` to create certificates in all related namespaces.

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

- `orangelab/gpu: "true"`
- `orangelab/gpu-nvidia: "true"`

For AMD GPUs:

- `orangelab/gpu: "true"`
- `orangelab/gpu-amd: "true"`

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

- access a detached Longhorn volume (f.e. cloned or restored from backup)
- access a snapshot of currently attached volume (when active pod doesn't have shell available)
- copy volume contents to local folder
- use export job to create archive with volume contents to USB drive
