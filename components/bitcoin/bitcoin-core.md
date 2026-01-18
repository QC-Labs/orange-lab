# Bitcoin Core

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
