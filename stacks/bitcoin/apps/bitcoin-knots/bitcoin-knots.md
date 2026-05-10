# Bitcoin Knots

|              |                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Homepage     | https://bitcoinknots.org/                                                                           |
| Docker image | https://hub.docker.com/r/btcpayserver/bitcoinknots                                                  |
| Dockerfile   | https://github.com/btcpayserver/dockerfile-deps/blob/master/BitcoinKnots/28.1/linuxamd64.Dockerfile |

Bitcoin Knots is a conservative fork of Bitcoin Core with a focus on stability and conservative improvements. The node uses persistent volume storage mounted at `/data`.

```sh
pulumi config set bitcoin-knots:enabled true

# (Recommended) Lock version
pulumi config set bitcoin-knots:image btcpayserver/bitcoinknots:28.1

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

## Custom images

By default `btcpayserver/bitcoinknots` images are used. You can use custom docker images as well.

For example if you decide to run BIP-110 variant:

```sh
# set custom image location
# sha256 is not required but recommended to ensure image has not been modified
# docker tags are mutable so the repository will return 404 if hash doesn't match
pulumi config set bitcoin-knots:image ghcr.io/retropex/bitcoin:29.3.knots20260210-bip110-v0.3@sha256:6508ab365d90f5dfcad97130cee52f011d85dfa0b5b2a5695350eb4e045ca68b

# where to mount volume, this needs to match VOLUME in Dockerfile (/data by default)
pulumi config set bitcoin-knots:volumePath /data/.bitcoin

# remove "bitcoind" from command, needed when image uses non-standard ENTRYPOINT
pulumi config set bitcoin-knots:commandArgs ''

# (Optional) add more logging to see mempool transaction rejections
pulumi config set bitcoin-knots:debug 'true'
```

You can find sha256 hash with:

```sh
skopeo inspect docker://ghcr.io/retropex/bitcoin:29.2.knots20251110-bip110-v0.1 | jq .Digest
```
