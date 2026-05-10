# Office Stack

Components related to office productivity and collaboration.

**Prerequisite**: Core stack must be deployed first (network, storage).

## Components

- [Nextcloud](./apps/nextcloud/nextcloud.md) - Self-hosted productivity platform for file storage, collaboration, and office apps.

## Deploy

```sh
cd stacks/office
pulumi stack init <stack> # f.e. lab-office
pulumi up
```

## Migrate from Root Stack

If Nextcloud was previously deployed in the root stack, migrate its settings before deploying in this stack.

Plain values can just be copied from `Pulumi.<stack>.yaml` to `stacks/office/Pulumi.<stack>.yaml`.

Secrets use different encryption keys so the values have to exported first.

Get plaintext values from the root stack:

```sh
cd / # project root
pulumi config get nextcloud:enabled
pulumi config get nextcloud:fromVolume
pulumi config get nextcloud:db/fromVolume
pulumi config get nextcloud:requiredNodeLabel
pulumi config get --secret nextcloud:db/password
pulumi config get --secret nextcloud:db/rootPassword
```

Then set them in the office stack:

```sh
cd stacks/office
pulumi config set nextcloud:enabled true
pulumi config set nextcloud:fromVolume <value>
pulumi config set nextcloud:db/fromVolume <value>
pulumi config set nextcloud:requiredNodeLabel <value>
pulumi config set --secret nextcloud:db/password <value>
pulumi config set --secret nextcloud:db/rootPassword <value>
```

## Configure Applications

### Nextcloud

```sh
pulumi config set nextcloud:enabled true
pulumi up
```
