# Application Configuration

This document describes application configuration and common settings for OrangeLab.

## Deploying Applications

After system components have been deployed, you can add any of the optional applications.

All available settings can be found in `Pulumi.yaml`. Override defaults with `pulumi config` or by directly modifying `Pulumi.<stack>.yaml`.

```sh
# enable app
pulumi config set <app>:enabled true

# configure app-specific settings from Pulumi.yaml if needed
pulumi config set ollama:hostname ollama-api
pulumi config set ollama:storageSize 100Gi

# deploy
pulumi up
# or
pulumi up -r # --refresh Pulumi state if out of sync

# Make request to provision HTTP certificate and activate endpoint
curl https://<app>.<tsnet>.ts.net/
```

## Enable/Disable Applications

To remove an application, set the `enabled` flag to `false`. This will remove all resources associated with the app.

```sh
# Remove application including storage
pulumi config set <app>:enabled false
pulumi up
```

To keep storage around (for example downloaded Ollama models) but remove all other resources, use `storageOnly`:

```sh
# Remove application resources but keep related storage
pulumi config set <app>:enabled true
pulumi config set <app>:storageOnly true
# Optional: enable database in storageOnly mode if used by application
pulumi config set <app>:db/enabled true
pulumi up
```

## Common Configuration Settings

The following settings are supported by most applications in OrangeLab:

| Setting              | Description                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `enabled`            | Enable or disable the application                                                            |
| `hostname`           | Hostname for the HTTPS endpoint, used with Tailscale for access                              |
| `version`            | Lock Helm chart version to a specific release (uses latest if not specified)                 |
| `storageOnly`        | Disable application but retain storage (useful for temporarily disabling while keeping data) |
| `storageSize`        | Expand default storage size if needed (e.g., for large models)                               |
| `fromVolume`         | Attach existing Longhorn volume instead of creating new one                                  |
| `storageClass`       | Force specific storage class used by the application                                         |
| `preferredNodeLabel` | Deploy to node with specified label if exists (soft constraint)                              |
| `requiredNodeLabel`  | Deploy only to node with specified label (hard constraint)                                   |
| `backupVolume`       | Enable volume backups to S3-compatible storage                                               |

### Custom Hostnames

Set a custom hostname for the HTTPS endpoint:

```sh
pulumi config set ollama:hostname ollama-api
```

The application will be available at `https://ollama-api.<tsnet>.ts.net/`.

### Version Pinning

Lock a Helm chart to a specific version:

```sh
# latest used by default
pulumi config set longhorn:version 1.8.1
# some Helm charts allow to specify appVersion as well
# f.e. Open-WebUI to upgrade before new chart is published
pulumi config set open-webui:appVersion 0.6.1
```

### Node Placement

Control which nodes run specific applications:

```sh
# Soft constraint - prefer this node if available
pulumi config set ollama:preferredNodeLabel orangelab/ollama

# Hard constraint - only run on these nodes
pulumi config set prometheus:requiredNodeLabel orangelab/prometheus=true
```

### AMD GPU

GPU node labeling is automatic with Node Feature Discovery (NFD) enabled.

Switch to ROCm image if needed:

```sh
pulumi config set ollama:amd-gpu true
```

More details at [/components/system/amd-gpu-operator/amd-gpu-operator.md](/components/system/amd-gpu-operator/amd-gpu-operator.md)

### Storage

```sh
# Removes all resources (incl. storage) when false
pulumi config set ollama:enabled false
pulumi up

# Disable application but retain its storage volumes (when using dynamic volumes):
pulumi config set ollama:storageOnly true
pulumi up

# Expand storage size to 200GB
# Live expansion not supported when using existing volumes, need to detach first
# For local volumes it's not enforced by Kubernetes (used for scheduling only)
pulumi config set ollama:storageSize 200Gi

# Attach existing Longhorn volume to an application.
# Volumes can be cloned or restored from a backup using Longhorn UI.
pulumi config set ollama:fromVolume existing-volume-name

# Enable backups to S3-compatible storage
# Ignored when `longhorn:backupAllVolumes` is enabled
pulumi config set ollama:backupVolume true
```

This approach allows you to safely disable applications without losing data, even during breaking changes.

#### Using Static Volume Names

While dynamically provisioned volumes are convenient for initial deployments, using static volumes allows you to shutdown all application resources without loss of data. It also helps with having descriptive names for volumes instead of auto-generated ones.

Recommended Workflow to create static volumes:

```sh
# Start with dynamic volumes for initial deployment
pulumi config set <app>:enabled true
pulumi up

# Once app is stable, stop it but leave storage around
pulumi config set <app>:storageOnly true
pulumi up

# Clone the volume in Longhorn UI and give it descriptive name, f.e. the app name

# Attach the cloned/restored volume and start the app
pulumi config set <app>:fromVolume "<volume>"
pulumi config set <app>:enabled true
pulumi config delete <app>:storageOnly
pulumi up
```

### Storage class

Default storage classes:

- Regular applications: `longhorn`
- GPU workloads: `longhorn-gpu`
- Large volumes: `longhorn-large`

For single node or non-Linux systems, you can use override application to use `local-path` storage class instead:

```sh
pulumi config set longhorn:enabled false

pulumi config set ollama:storageClass local-path
```
