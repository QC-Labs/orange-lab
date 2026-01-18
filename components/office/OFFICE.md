# Office module

Components related to office productivity and collaboration.

## Recommended setup/tldr

```sh
pulumi config set nextcloud:enabled true

# When restoring from backup
pulumi config set nextcloud:fromVolume: nextcloud
pulumi config set nextcloud:db/fromVolume: nextcloud-db
pulumi config set --secret nextcloud:db/password <nextcloud-password>
pulumi config set --secret nextcloud:db/rootPassword <root-password>

pulumi up
```

## Components

- [Nextcloud](./nextcloud.md) - Self-hosted productivity platform for file storage, collaboration, and office apps.
