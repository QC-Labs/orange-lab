# Data module

Components related to databases and data storage for applications, including PostgreSQL (CloudNativePG) and MariaDB operators.

These components are optional. If you attempt to install an application or component that depends on a database and the required data component is not present, you will receive an error message indicating which database component to install.

---

## MariaDB Operator

|             |                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Homepage    | https://mariadb-operator.github.io/mariadb-operator/                                                      |
| Helm values | https://github.com/mariadb-operator/mariadb-operator/blob/main/deploy/charts/mariadb-operator/values.yaml |
| Dockerfile  | https://github.com/MariaDB/mariadb-docker/blob/master/main/Dockerfile                                     |

The MariaDB Operator manages MariaDB/MySQL databases on Kubernetes using CRDs. It provisions and manages clusters, users, and databases declaratively.

### Installation

```sh
pulumi config set mariadb-operator:enabled true
```

#### Override root password

When restoring from backup, the generated root password won't match the one already in database. You have to either reset it (recommended) or use specific password to avoid auto-generation.

```sh
pulumi config set --secret <app>:db/rootPassword <root-password>
```

#### Resetting root password

```sh
# Shutdown all containers except database
pulumi config set <app>:storageOnly=true
pulumi config set <app>/db:enabled=true

# Disable MariaDB authentication (allows logging in as root without password)
pulumi config set <app>/db:disableAuth=true
pulumi up

# log into the MariaDB container
kubectl exec -it <app>-db-0 -n <app> -- mariadb -u root
```

Update root password using MariaDB CLI:

```sh
# Initialize grant tables
FLUSH PRIVILEGES;

# Reset password, make sure it matches the `rootPassword` value in `<app>-db-secret`
ALTER USER 'root'@'%' IDENTIFIED BY '<root-password>';
ALTER USER 'root'@'localhost' IDENTIFIED BY '<root-password>';
FLUSH PRIVILEGES;
```

Exit with CTRL-D. Cleanup and re-enable database authentication:

```sh
# Enable MariaDB authentication
pulumi config rm <app>/db:disableAuth
pulumi up

# Remove temporary config keys to start the apps using the database
pulumi config rm <app>:storageOnly
pulumi config rm <app>/db:enabled
pulumi up
```

---

## CloudNativePG Operator

|                |                                                                                      |
| -------------- | ------------------------------------------------------------------------------------ |
| Homepage       | https://cloudnative-pg.io/                                                           |
| Helm chart     | https://github.com/cloudnative-pg/charts                                             |
| Helm values    | https://github.com/cloudnative-pg/charts/blob/main/charts/cloudnative-pg/values.yaml |
| Cluster values | https://github.com/cloudnative-pg/charts/blob/main/charts/cluster/values.yaml        |

This component installs the CloudNativePG PostgreSQL operator using its official Helm chart. It manages the installation of CRDs and the operator itself, and supports optional monitoring integration.

### Installation

```sh
# Optional: install CNPG kubectl plugin
brew install kubectl-cnpg

pulumi config set cloudnative-pg:enabled true
```

When setting `<app>:storageOnly` to `true`, databases are shut down and only storage is retained. To keep PostgreSQL running, use:

```sh
pulumi config set <app>:db/enabled true
```

#### Manual Backup and Restore

For manual database operations, use the provided scripts in the `scripts/` directory:

**Database Dump:**

```sh
# Create a database dump
./scripts/pg-dump.sh <app-name> [namespace]

# Example: dump n8n database
./scripts/pg-dump.sh n8n
# Creates: n8n.dump
```

**Database Restore:**

```sh
# Restore from a dump file
./scripts/pg-restore.sh <app-name> [namespace]

# Example: restore n8n database
./scripts/pg-restore.sh n8n
# Requires: n8n.dump file to exist
```

#### Uninstall

```sh
pulumi config set cloudnative-pg:enabled false
pulumi up

# Remove all CRDs (required before reinstalling)
kubectl delete crd \
  backups.postgresql.cnpg.io \
  clusterimagecatalogs.postgresql.cnpg.io \
  clusters.postgresql.cnpg.io \
  databases.postgresql.cnpg.io \
  imagecatalogs.postgresql.cnpg.io \
  poolers.postgresql.cnpg.io \
  publications.postgresql.cnpg.io \
  scheduledbackups.postgresql.cnpg.io \
  subscriptions.postgresql.cnpg.io
```
