# Bitcoin Knots

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
pulumi config set bitcoin-knots:commandArgs "bitcoind -maxconnections=25"

# Force rebuilding chain state
pulumi config set bitcoin-knots:commandArgs "bitcoind -reindex-chainstate"

pulumi up
```

You can disable the app but keep blockchain data with:

```sh
pulumi config set bitcoin-knots:storageOnly true
pulumi up
```
