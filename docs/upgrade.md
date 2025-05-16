# Upgrade Guide

This guide explains the process for upgrading your Orange Lab installation.

## Standard Upgrades

```sh
# Pull the latest changes
git pull

# Apply changes, make sure you verify the changes first
pulumi up
```

If any application has problems deploying or gets stuck, try disabling and enabling the app while keeping storage intact:

```sh
pulumi config set <app>:enabled true
pulumi config set <app>:storageOnly true
pulumi up

pulumi config delete <app>:storageOnly
pulumi up
```

## Handling Breaking Changes

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

### Upgrade Procedure

Once you created the new static volume, disable the app completely and then enable it again. Only the related `PersistentVolume` and it's claim will be removed but the volume will just be detached in Longhorn and can be reused.

Do this for all affected applications:

```sh
git pull

pulumi config set <app>:enabled false
pulumi up

pulumi config set <app>:enabled true
pulumi up
```
