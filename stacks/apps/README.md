# Apps Stack

General-purpose tools and utilities.

**Prerequisite**: Core stack must be deployed first (network and storage).

## Components

- [Nextcloud](./components/nextcloud/nextcloud.md) — Self-hosted productivity platform
- [Vaultwarden](./components/vaultwarden/vaultwarden.md) — Bitwarden-compatible password manager

## Configure Applications

### Nextcloud

```sh
# Confirm you have mariadb-operator is already installed
pulumi config set mariadb-operator:enabled true
# Enable NextCloud
pulumi config set nextcloud:enabled true
pulumi up
```

### Vaultwarden

```sh
pulumi config set vaultwarden:enabled true

pulumi up
```
