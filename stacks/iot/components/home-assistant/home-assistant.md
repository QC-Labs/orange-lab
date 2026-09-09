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

## Pocket ID Launcher

Home Assistant does not support Pocket ID as a native OIDC login provider, but it
can appear in Pocket ID's App Dashboard as a launcher available to every Pocket
ID user:

```sh
# From stacks/iot
HOME_ASSISTANT_URL=$(pulumi stack output --json | jq -er '.endpoints.homeAssistant')

../../scripts/pocket-client.sh \
  --app-name home-assistant \
  --client-name "Home Assistant" \
  --launch-url "$HOME_ASSISTANT_URL" \
  --callback-url "$HOME_ASSISTANT_URL/" \
  --dark-icon-url "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/home-assistant.png" \
  --light-icon-url "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/home-assistant.png"
```

Do not apply the `home-assistant:auth` commands printed by the script; Home
Assistant uses the client only as a Pocket ID launcher and does not support
Pocket ID OIDC login.

## Device access

Home Assistant can access host devices such as USB or serial adapters. Configure
each device with a unique volume name and its path on the node:

```sh
pulumi config set home-assistant:devices '[{"name":"connect-zbt-2","device":"/dev/ttyACM0"}]'
```

The device must exist at the configured path on the node where Home Assistant
is scheduled. Device mounts automatically enable privileged mode for the
container, as required by the Home Assistant Helm chart. Only configure the
device paths that Home Assistant needs.
