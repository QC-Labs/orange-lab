# Bitcoin Core

|              |                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Homepage     | https://bitcoincore.org/                                                                       |
| Docker image | https://hub.docker.com/r/btcpayserver/bitcoin                                                  |
| Dockerfile   | https://github.com/btcpayserver/dockerfile-deps/blob/master/Bitcoin/29.0/linuxamd64.Dockerfile |

Bitcoin Core is the reference implementation of the Bitcoin protocol. The node uses persistent volume storage mounted at `/data`.

```sh
pulumi config set bitcoin-core:enabled true

# (Recommended) Lock version
pulumi config set bitcoin-core:image btcpayserver/bitcoin:29.0

# Optional configuration
pulumi config set bitcoin-core:prune 1000  # Prune mode (MB), 0 for full node with txindex
pulumi config set bitcoin-core:commandArgs "bitcoind -datadir=/data -conf=/conf/bitcoin.conf -maxuploadtarget=500"

# Force rebuilding chain state
pulumi config set bitcoin-core:commandArgs "bitcoind -datadir=/data -conf=/conf/bitcoin.conf -reindex-chainstate"

pulumi up
```

You can disable the app but keep blockchain data with:

```sh
pulumi config set bitcoin-core:storageOnly true
pulumi up
```

## Custom images

By default `btcpayserver/bitcoin` images are used. You can use custom docker images as well.

### bitcoin/bitcoin

`bitcoin/bitcoin` runs as UID 1000. Unlike `btcpayserver/bitcoin`, it does not start as root and fix permissions automatically. Set both values to the same UID so the container can read and write `/data`:

```sh
# set custom image location
pulumi config set bitcoin-core:image bitcoin/bitcoin:29.0

pulumi config set bitcoin-core:runAsUser 1000
pulumi config set bitcoin-core:volumeOwnerUserId 1000

# optional: override the command if the image has a non-standard ENTRYPOINT
# pulumi config set bitcoin-core:command bitcoind
```

If migrating from `btcpayserver/bitcoin`, your volume is likely owned by UID 999. To avoid re-downloading the chain, use `runAsUser: 999` and `volumeOwnerUserId: 999` instead, or run a one-time `chown -R 1000:1000 /data` on the volume.
