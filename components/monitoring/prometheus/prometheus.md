# Prometheus

|            |                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------ |
| Homepage   | https://prometheus.io/                                                                     |
| Helm chart | https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack |
| Endpoints  | `https://grafana.<domain>/`                                                                |
|            | `https://prometheus.<domain>/`                                                             |
|            | `https://alertmanager.<domain>/`                                                           |

Prometheus provides much more detailed monitoring of the cluster. Many tools (like Headlamp) integrate with it to show metrics for Kubernetes resources.

Enabling it will increase traffic between nodes. Expect over 1GB of data saved to storage per day, even with just a few nodes.

```sh
# Enable Prometheus
pulumi config set prometheus:enabled true

# (Recommended) only deploy to labeled nodes
pulumi config set prometheus:requiredNodeLabel node-role.kubernetes.io/prometheus=true
kubectl label nodes <node-name> node-role.kubernetes.io/prometheus=true

# (optional) Override grafana "admin" password (auto-generated if not set)
pulumi config set prometheus:grafana/password <password> --secret

pulumi up
```

## Grafana credentials

The grafana admin password is auto-generated if not configured. To preserve it across stack recreation, save it after initial deployment:

```sh
# show the generated password
PASSWORD=$(pulumi stack output monitoring.grafanaPassword --show-secrets)

# set prometheus:grafana/password secret
pulumi config set prometheus:grafana/password $(PASSWORD) --secret
```

### Resetting password

```sh
kubectl exec -n prometheus deploy/prometheus-grafana -- grafana-cli admin reset-admin-password <new-password>
```

## Grafana dashboards

Once Prometheus is installed, additional metrics and Grafana dashboards can be enabled for applications that support it.

```sh
# Enable additional metrics and dashboards
# IMPORTANT: only enable once Prometheus has been installed.
pulumi config set prometheus:enableComponentMonitoring true
pulumi up
```

## Uninstall

```sh
# Remove application monitoring before uninstalling Prometheus
pulumi config set prometheus:enableComponentMonitoring false
pulumi up

# Remove Prometheus
pulumi config set prometheus:enabled false
pulumi up
```

CRDs need to be removed manually, more info at https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack#uninstall-helm-chart
