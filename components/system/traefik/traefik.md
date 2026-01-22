# Traefik

|               |                                                                               |
| ------------- | ----------------------------------------------------------------------------- |
| Homepage      | https://traefik.io/                                                           |
| Helm chart    | https://github.com/traefik/traefik-helm-chart                                 |
| Values        | https://github.com/traefik/traefik-helm-chart/blob/master/traefik/values.yaml |
| Documentation | https://doc.traefik.io/traefik/                                               |
| Dashboard     | https://traefik.<domain>/                                                     |

Traefik is a cloud-native edge router that handles external HTTP/HTTPS traffic to cluster. It's installed automatically when `customDomain` is configured and serves as a ingress controller for custom domain services.

## Installation

```sh
# customDomain is required
pulumi config set orangelab:customDomain example.com
pulumi config set traefik:enabled true

# (Optional) Limit which nodes should run Traefik. By default all nodes
pulumi config set traefik:requiredNodeLabel: kubernetes.io/hostname=<host>

# (Optional) Change dashboard hostname
pulumi config set traefik:hostname traefik

pulumi up
```
