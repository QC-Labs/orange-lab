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

You can automatically add all agents by enabling universal token (Settings -> Token & Fingerprints -> Universal token).

```sh
# replace <KEY> with the copied value "ssh-ed25519 ..."
pulumi config set beszel:hubKey <KEY>
# copy universal token from UI so agents can automatically register
pulumi config set beszel:TOKEN <TOKEN> --secret
pulumi up
```

Make sure to allow traffic to agents on port `45876`:

```sh
firewall-cmd --permanent --add-port=45876/tcp
```

## Prometheus

|            |                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------ |
| Homepage   | https://prometheus.io/                                                                     |
| Helm chart | https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack |
| Endpoints  | `https://grafana.<tsnet>.ts.net/`                                                          |
|            | `https://prometheus.<tsnet>.ts.net/`                                                       |
|            | `https://alertmanager.<tsnet>.ts.net/`                                                     |

Prometheus provides much more detailed monitoring of the cluster. Many tools (like Headlamp) integrate with it to show metrics for Kubernetes resources.

Enabling it will increase traffic between nodes. Expect over 1GB of data saved to storage per day, even with just a few nodes.

Components will be deployed to all nodes by default. You can restrict that with `requiredNodeLabel` to deploy only to selected nodes:

```sh
# (optional) only deploy to labeled nodes
pulumi config set prometheus:requiredNodeLabel orangelab/prometheus=true
# (optional) You need at least one node with orangelab/prometheus label
kubectl label nodes <node-name> orangelab/prometheus=true

# Enable Prometheus
pulumi config set prometheus:enabled true

# (optional) Override grafana "admin" password
pulumi config set prometheus:grafana-password <password> --secret

pulumi up
```

### Grafana dashboards

Once Prometheus is installed, additional metrics and Grafana dashboards can be enabled for applications that support it.

```sh
# Enable additional metrics and dashboards
# IMPORTANT: only enable once Prometheus has been installed.
pulumi config set prometheus:enableComponentMonitoring true
pulumi up
```

To remove dashboards created by @pulumiverse/grafana (not used anymore):

```sh
STACK=lab

pulumi state delete "urn:pulumi:$STACK::orangelab::orangelab:system\$orangelab:system:AmdGPUOperator\$grafana:oss/dashboard:Dashboard::amd-gpu-operator-node-dashboard"
pulumi state delete "urn:pulumi:$STACK::orangelab::orangelab:system\$orangelab:system:TailscaleOperator\$grafana:oss/dashboard:Dashboard::tailscale-operator-dashboard"
pulumi state delete "urn:pulumi:$STACK::orangelab::orangelab:system\$orangelab:system:AmdGPUOperator\$grafana:oss/dashboard:Dashboard::amd-gpu-operator-job-dashboard"
pulumi state delete "urn:pulumi:$STACK::orangelab::orangelab:system\$orangelab:system:AmdGPUOperator\$grafana:oss/dashboard:Dashboard::amd-gpu-operator-overview-dashboard"
pulumi state delete "urn:pulumi:$STACK::orangelab::orangelab:system\$orangelab:system:AmdGPUOperator\$grafana:oss/dashboard:Dashboard::amd-gpu-operator-gpu-dashboard"
pulumi state delete "urn:pulumi:$STACK::orangelab::orangelab:system\$orangelab:system:Longhorn\$grafana:oss/dashboard:Dashboard::longhorn-dashboard"
```

### Uninstall

```sh
# Remove application monitoring before uninstalling Prometheus
pulumi config set prometheus:enableComponentMonitoring false
pulumi up

# Remove Prometheus
pulumi config set prometheus:enabled false
pulumi up
```

CRDs need to be removed manually, more info at https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack#uninstall-helm-chart
