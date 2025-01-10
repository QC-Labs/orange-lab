# Monitoring

Optional components related monitoring the cluster.

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
