# Upgrade Guide

This guide explains the process for upgrading your Orange Lab installation.

## AI-assisted upgrades

You can use AI to guide you through the migration process or follow manual instructions below.

```sh
opencode

# switch to PLAN mode

# ctrl-x m to select AI model

# run command
/orangelab-upgrade
```

## Prerequisites

The general procedure is:
- make sure all apps can be shut down with no data loss (static volumes used, secrets saved)
- get latest code
- rebuild @orangelab/pulumi library
- pulumi up
- disable/re-enable any app with breaking changes

### Preparing Volumes for Recovery

Breaking changes might require removing an application including it's storage. The easiest method is to create a new volume to use in Longhorn UI, either by restoring volume from a recent backup or by cloning an existing dynamic volume.

Once you switch from dynamic volume to static and use `fromVolume`, all further upgrades become easier and you just need to disable and enable applications as the storage will be kept unless you remove it in UI.

```sh
pulumi config set <app>:enabled false
pulumi up

pulumi config set <app>:fromVolume "<volume-name>"
pulumi config set <app>:enabled true
pulumi up
```

### Saving Secrets Before Disabling Apps

Before disabling apps with databases or encryption, save their secrets to Pulumi config to ensure the same credentials are used when re-enabling.

Apps with secrets: `n8n` (encryption key + PostgreSQL), `nextcloud` (MariaDB), `mempool` (MariaDB)

```sh
# Get secret value from stack output (find <module> and <path> in pulumi stack output --json)
pulumi stack output <module> --show-secrets --json | jq -r '.<app>.<path>'

# Save to config (check <app>.ts for config key names)
pulumi config set <app>:<config-key> "<value>" --secret
```

## Upgrade Procedure

Once you have static volumes configured and secrets saved, update the code:

```sh
# Pull the latest changes
git pull
# Build packages/pulumi
npm run build

# Apply, make sure you verify the changes before confirming
pulumi up
```

If any application has problems deploying, try disabling the app first. Make sure you use static Longhorn volumes so your data is not lost (check )

```sh
pulumi config set <app>:enabled false
pulumi up

pulumi config set <app>:enabled true
pulumi up
```
