# Monitoring

Optional components related monitoring the cluster.

Recommended setup:

```sh
pulumi config set beszel:enabled true
pulumi up

# copy key from UI
pulumi config set beszel:hubKey <KEY>
pulumi up

# add hosts using UI
```

## Beszel

|           |                                    |
| --------- | ---------------------------------- |
| Homepage  | https://beszel.dev/                |
| Endpoints | `https://beszel.<tsnet>.ts.net/`   |
|           | `https://beszel.<tsnet>.ts.net/_/` |

A lightweight alternative to Prometheus.

First deploy Beszel hub with:

```sh
pulumi config set beszel:enabled true
pulumi up
```

Once the hub is deployed, go to `beszel.<tsnet>.ts.net` endpoint and create an admin account.

To deploy agents you need to find the generated public key. Click `Add system`, then copy the `Public key` field. Close the popup and do not add any systems yet.

```sh
# replace <KEY> with the copied value "ssh-ed25519 ..."
pulumi config set beszel:hubKey <KEY>
pulumi up
```

Make sure to allow traffic to agents on port `45876`:

```sh
firewall-cmd --permanent --add-port=45876/tcp
```

Once the agents are deployed, you need to manually add them in the UI of Beszel. Click `Add system`, select `docker`, then enter the hostname in the `Name` field and Tailscale IP in `Host/IP`

You can find the IP address of your node using one of two ways:

```sh
# List all hosts and IPs
tailscale status

# List only nodes added to cluster
kubectl get nodes -o json | jq -r '.items[] | .metadata.name + " - " + .metadata.annotations["flannel.alpha.coreos.com/public-ip"]'
```

## Prometheus

|            |                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------ |
| Homepage   | https://prometheus.io/                                                                     |
| Helm chart | https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack |
| Endpoints  | `https://grafana.<tsnet>.ts.net/`                                                          |
|            | `https://prometheus.<tsnet>.ts.net/`                                                       |
|            | `https://alertmanager.<tsnet>.ts.net/`                                                     |

Prometheus monitoring is disabled by default to keep resource usage low.

Enabling it will increase traffic between nodes and deploy components to all nodes but is useful for troubleshooting the cluster.

```sh
pulumi config set prometheus:enabled true

# (optional) Override grafana "admin" password
pulumi config set prometheus:grafana-password <password> --secret

pulumi up
```

### Grafana dashboards

Some applications have Grafana dashboards when `enableMonitoring` is on. The provider requires `url` and `auth` to be set in order to connect to the provisioned Grafana instance.

```sh
# Use your Tailnet domain name
pulumi config set grafana:url https://grafana.<tsnet>.ts.net/

# Basic auth user:password to Grafana frontend
pulumi config set grafana:auth admin:admin --secret
```

### Uninstall

CRDs need to be removed manually, more info at https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack#uninstall-helm-chart
