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
# Set it to your domain, this installs Traefik CRDs even is Traefik is disabled
pulumi config set orangelab:customDomain example.com

# (Optional) Limit which nodes should run Traefik. By default all nodes
pulumi config set traefik:requiredNodeLabel: kubernetes.io/hostname=<host>

# (Optional) Change dashboard hostname
pulumi config set traefik:hostname traefik

pulumi up
```

## Uninstall

Traefik CRDs left intact when `customDomain` set but the pods can be removed temporarily if needed.

```sh
pulumi config set traefik:enabled false
pulumi up
```
