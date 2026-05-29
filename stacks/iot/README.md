# IoT Stack

Components related to IoT (Internet of Things) sensors and home automation.

**Prerequisite**: Core stack must be deployed first (network, storage).

## Components

- [Home Assistant](./components/home-assistant/home-assistant.md) - Open source home automation platform that puts local control and privacy first.

## Deploy

```sh
cd stacks/iot
pulumi stack init <stack> # f.e. lab-iot
pulumi up
```

## Configure Applications

### Home Assistant

```sh
pulumi config set home-assistant:enabled true
pulumi up
```
