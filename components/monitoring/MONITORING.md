# Monitoring

Optional components related monitoring the cluster.

## Quick Start

```sh
pulumi config set beszel:enabled true
pulumi up

# copy key from UI
pulumi config set beszel:hubKey <KEY>
pulumi up

# add hosts using UI
```

## Components

- [Beszel](./beszel/beszel.md) - Lightweight resource monitoring for servers and containers.
- [Prometheus](./prometheus/prometheus.md) - Comprehensive monitoring system with Grafana dashboards.
