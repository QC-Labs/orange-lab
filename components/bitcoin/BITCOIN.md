# Bitcoin module

Components related to Bitcoin network nodes and related services.

Recommended setup/tldr:

```sh
# Create 1TB volume in Longhorn called "bitcoin"

# Start node using the volume
pulumi config set bitcoin-knots:enabled true
pulumi config set bitcoin-knots:version 28.1
pulumi config set bitcoin-knots:fromVolume bitcoin

pulumi up
```

Initial blockchain synchronization takes a long time as about 700GB need to be downloaded.
You can check the status with:

```sh
# install bitcoin-cli locally if needed
brew install bitcoin

# Wrapper that will add RPC authentication
./scripts/bitcoin-cli.sh -getinfo
```

## Bitcoin Knots

|              |                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Homepage     | https://bitcoinknots.org/                                                                           |
| Docker image | https://hub.docker.com/r/btcpayserver/bitcoinknots                                                  |
| Dockerfile   | https://github.com/btcpayserver/dockerfile-deps/blob/master/BitcoinKnots/28.1/linuxamd64.Dockerfile |

Bitcoin Knots is a conservative fork of Bitcoin Core with a focus on stability and conservative improvements. The node uses persistent volume storage mounted at `/data`.

```sh
# Required configuration
pulumi config set bitcoin-knots:enabled true

# Lock version (recommended)
pulumi config set bitcoin-knots:version 28.1

# Optional configuration
pulumi config set bitcoin-knots:prune 1000  # Prune mode (MB), 0 for full node with txindex
pulumi config set bitcoin-knots:extraArgs "--maxconnections=25"  # Additional bitcoind args

pulumi up
```

You can disable the app but keep blockchain data with:

```sh
pulumi config set bitcoin-knots:storageOnly true
pulumi up
```

## Bitcoin Core

|              |                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Homepage     | https://bitcoincore.org/                                                                       |
| Docker image | https://hub.docker.com/r/btcpayserver/bitcoin                                                  |
| Dockerfile   | https://github.com/btcpayserver/dockerfile-deps/blob/master/Bitcoin/29.0/linuxamd64.Dockerfile |

Bitcoin Core is the reference implementation of the Bitcoin protocol. The node uses persistent volume storage mounted at `/data`.

```sh
# Required configuration
pulumi config set bitcoin-core:enabled true

# Lock version (recommended)
pulumi config set bitcoin-core:version 29.0

# Optional configuration
pulumi config set bitcoin-core:prune 1000  # Prune mode (MB), 0 for full node with txindex
pulumi config set bitcoin-core:extraArgs "-maxuploadtarget=500"  # Additional bitcoind args

pulumi up
```

You can disable the app but keep blockchain data with:

```sh
pulumi config set bitcoin-core:storageOnly true
pulumi up
```

## Electrs

|              |                                                                    |
| ------------ | ------------------------------------------------------------------ |
| Homepage     | https://github.com/romanz/electrs                                  |
| Docker image | https://hub.docker.com/r/getumbrel/electrs                         |
| Dockerfile   | https://github.com/getumbrel/docker-electrs/blob/master/Dockerfile |

Electrs is an implementation of the Electrum Server, which provides efficient querying of blockchain data and is used by wallet software to interact with the blockchain. It requires a full Bitcoin node (Core or Knots) to operate. Electrs uses persistent volume storage mounted at `/data`.

```sh
# Required configuration
pulumi config set electrs:enabled true

# Optional configuration
pulumi config set electrs:version v0.10.9

pulumi up
```

Once indexing finishes, use `electrs:50001` to connect your wallets. More info at [Electrs wallet guide](../../docs/electrs-wallet.md)

## Mempool

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
