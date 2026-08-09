# Multi-Stack Deployment

OrangeLab supports deploying modules as independent Pulumi stacks. This allows you to manage different parts of your infrastructure separately and reducing update time.

All stacks target the **same Kubernetes cluster**. The core stack must be deployed first because it installs CRDs, storage classes, and ingress controllers that module stacks depend on.

Each additional stack is independent and can be destroyed and re-deployed without affecting the rest of the cluster.

## Available Stacks

| Module   | Path                                              | Description                             |
|----------|---------------------------------------------------|-----------------------------------------|
| Apps     | [`stacks/apps/`](./stacks/apps/README.md)         | General-purpose tools and utilities     |
| AI       | [`stacks/ai/`](./stacks/ai/README.md)             | AI workloads, LLMs                      |
| Bitcoin  | [`stacks/bitcoin/`](./stacks/bitcoin/README.md)   | Bitcoin nodes and blockchain tools      |
| Dev      | [`stacks/dev/`](./stacks/dev/README.md)           | Development and debugging utilities     |
| IoT      | [`stacks/iot/`](./stacks/iot/README.md)           | Home automation and IoT platforms       |
| Media    | [`stacks/media/`](./stacks/media/README.md)       | Photo backup, streaming, *arr stack     |

## Prerequisites

Before deploying any module stack, deploy the core stack:

```sh
cd /
pulumi up
```

Core must include:
- [Network](./components/network/NETWORK.md) — routing provider (Tailscale or Traefik)
- [Storage](./components/storage/STORAGE.md) — Longhorn or local-path storage class
- [Data](./components/data/DATA.md) — database operators if apps need them

## Deploying a Module Stack

### Example: Media Stack

```sh
cd stacks/media

# Initialize the stack
pulumi stack init <stack> # f.e. lab

# Configure shared settings (copy from core stack overrides)
pulumi config set orangelab:routingProvider traefik
pulumi config set orangelab:customDomain example.com

# Enable media applications
pulumi config set jellyfin:enabled true
pulumi config set jellyfin:media/hostPath /mnt/media
pulumi config set radarr:enabled true
pulumi config set sonarr:enabled true

# Deploy current stack (lab-media)
pulumi up

# Undeploy the stack, make sure you use static volumes and fromVolume setting so no data is lost
pulumi destroy
```

### Config Structure

Each module stack has its own `Pulumi.yaml` with default values. Stack-specific overrides go in `Pulumi.<stack>.yaml`:

```
stacks/<module>/
├── Pulumi.yaml              # Project name + shared defaults
├── Pulumi.<stack>.yaml      # Stack-specific overrides
├── index.ts                 # Entry point
└── components/              # Module components
```

Shared and module dependency config keys:

| Key                           | Example                  | Purpose                                  |
|-------------------------------|--------------------------|------------------------------------------|
| `orangelab:routingProvider`   | `traefik` or `tailscale` | Ingress/routing                          |
| `orangelab:customDomain`      | `example.com`            | Traefik domain                           |
| `longhorn:backupEnabled`      | `false`                  | Enable Longhorn backup jobs              |
| `longhorn:backupAllVolumes`   | `false`                  | Back up all application volumes by default |
| `mariadb-operator:enabled`   | `false`                  | Enable MariaDB for dependent applications |
| `cloudnative-pg:enabled`     | `false`                  | Enable PostgreSQL for dependent applications |

The routing keys must be configured in every module stack. The Longhorn backup
defaults are defined in every `stacks/*/Pulumi.yaml`; keep both set to `false`
unless backups have been configured for that stack. Enable them separately in
each stack that should use backups. Individual applications can override
`backupAllVolumes` with their `<app>:backupVolume` setting.

Database operator settings are module dependencies and are included only in
stacks with applications that use them. Keep them disabled unless an
application in that stack uses the corresponding database; enable the operator
in the module stack before enabling that application. MariaDB-backed
applications require `mariadb-operator:enabled: true`, while PostgreSQL-backed
applications require `cloudnative-pg:enabled: true`.

## Migrating a Module from Core Stack

To move a module from the monolithic core stack to its own stack:

1. **Disable the module in core**:
   ```sh
   # In root Pulumi.<stack>.yaml, set all module apps to false
   pulumi config set jellyfin:enabled false
   # ... etc for all apps in the module
   ```

2. **Deploy core without the module**:
   ```sh
   cd /
   pulumi up
   ```

3. **Configure the module stack**:
    ```sh
    cd stacks/<module>
    # initialize new stack
    pulumi stack init lab
    # select stack as active
    pulumi stack select lab

    # Copy shared settings from root Pulumi.lab.yaml
    pulumi config set orangelab:routingProvider traefik
    pulumi config set orangelab:customDomain example.com
    pulumi config set mariadb-operator:enabled true

    # Copy app overrides from root Pulumi.lab.yaml
    # Secrets must be re-set because each stack has its own encryption key
    # Check secrets in old stack: pulumi config --show-secrets
    pulumi config set --secret vaultwarden:adminToken <value>
    pulumi config set --secret vaultwarden:smtp/password <value>
    ```

4. **Deploy the module stack**:
    ```sh
    pulumi up
    ```
