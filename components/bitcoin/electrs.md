# Electrs

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
