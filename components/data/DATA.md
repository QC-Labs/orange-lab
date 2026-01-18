# Data module

Components related to databases and data storage for applications, including PostgreSQL (CloudNativePG) and MariaDB operators.

These components are optional. If you attempt to install an application or component that depends on a database and the required data component is not present, you will receive an error message indicating which database component to install.

### Node placement

```sh
# Uses app scheduling by default, example:
pulumi config set <app>:requiredNodeLabel kubernetes.io/hostname=<host>

# You can override it for database component.
# Helpful if you have specific nodes to run database workloads.
pulumi config set <app>:db/requiredNodeLabel kubernetes.io/hostname=<host>
```

## Components

- [MariaDB Operator](./mariadb-operator/mariadb-operator.md) - Management of MariaDB and MySQL databases using CRDs.
- [CloudNativePG Operator](./cloudnative-pg/cloudnative-pg.md) - Cloud native PostgreSQL operator for Kubernetes.
