# Apps Stack

General-purpose tools and utilities.

**Prerequisite**: Core stack must be deployed first (network and storage).

## Components

- [Vaultwarden](./components/vaultwarden/vaultwarden.md) — Bitwarden-compatible password manager

## Deploy

```sh
cd stacks/apps
pulumi stack init lab-apps
pulumi stack select lab-apps
```

## Configure Applications

### Vaultwarden

```sh
pulumi config set vaultwarden:enabled true

pulumi up
```
