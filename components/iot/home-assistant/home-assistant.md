# Home Assistant

|            |                                                               |
| ---------- | ------------------------------------------------------------- |
| Homepage   | https://www.home-assistant.io/                                |
| Helm chart | https://artifacthub.io/packages/helm/helm-hass/home-assistant |
| Endpoints  | `https://home-assistant.<domain>/`                            |

Using zone is optional, but helps with making sure the application is deployed on same network as the sensors.

## Installation

```sh
kubectl label nodes <node-name> topology.kubernetes.io/zone=home

pulumi config set home-assistant:enabled true

pulumi config set home-assistant:requiredNodeLabel "topology.kubernetes.io/zone=home"

pulumi up
```
