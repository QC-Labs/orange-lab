# IoT (Internet of Things)

Components related to IoT (Internet of Things) sensors and home automation.

## Home Assistant

|            |                                                               |
| ---------- | ------------------------------------------------------------- |
| Homepage   | https://www.home-assistant.io/                                |
| Helm chart | https://artifacthub.io/packages/helm/helm-hass/home-assistant |
| Endpoints  | `https://home-assistant.<tsnet>.ts.net/`                      |

Using zone is optional, but helps with making sure the application is deployed on same network as the sensors.

```sh
kubectl label nodes <node-name> topology.kubernetes.io/zone=home

pulumi config set orangelab:home-assistant true
pulumi config set home-assistant:zone home

pulumi up
```
