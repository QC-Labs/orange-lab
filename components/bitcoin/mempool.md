# Mempool

|                 |                                                |
| --------------- | ---------------------------------------------- |
| Homepage        | https://mempool.space/                         |
| Source code     | https://github.com/mempool/mempool/tree/master |
| Docker backend  | https://hub.docker.com/r/mempool/backend       |
| Docker frontend | https://hub.docker.com/r/mempool/frontend      |

Mempool provides a visualization of the Bitcoin blockchain and acts as a block explorer. This allows you to inspect transactions and your addresses privately.

```sh
# Make sure MariaDB-operator is installed
pulumi config set mariadb-operator:enabled true
pulumi up

# Set the required configuration
pulumi config set mempool:enabled true

# Optional configuration
pulumi config set mempool:version v3.2.1 # lock version
pulumi config set mempool:hostname explorer # override hostname

pulumi up

# Store root password in Pulumi config to avoid having to reset it later on backup restore
./scripts/mariadb-password.sh <app>
```

This will deploy Mempool frontend and backend connected to your Bitcoin node and Electrs server.

You can access the frontend at https://mempool/
