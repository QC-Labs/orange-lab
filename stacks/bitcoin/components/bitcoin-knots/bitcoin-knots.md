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
pulumi config set bitcoin-knots:commandArgs "bitcoind -datadir=/data -conf=/conf/bitcoin.conf -maxconnections=25"

# Force rebuilding chain state
pulumi config set bitcoin-knots:commandArgs "bitcoind -datadir=/data -conf=/conf/bitcoin.conf -reindex-chainstate"

pulumi up
```

You can disable the app but keep blockchain data with:

```sh
pulumi config set bitcoin-knots:storageOnly true
pulumi up
```

## Custom images

By default `btcpayserver/bitcoinknots` images are used. You can use custom docker images as well.

### bitcoinknots/bitcoin

`bitcoinknots/bitcoin` is published by the Bitcoin Knots project. The image has a hardcoded ENTRYPOINT that uses `/var/lib/bitcoind` and `/etc/bitcoin/bitcoin.conf`, so you need to override the command and set the container user:

```sh
# set custom image location
pulumi config set bitcoin-knots:image bitcoinknots/bitcoin:29.3.knots20260508

# override the hardcoded ENTRYPOINT to use /data and /conf
pulumi config set bitcoin-knots:command bitcoind
pulumi config set bitcoin-knots:commandArgs "-datadir=/data -conf=/conf/bitcoin.conf -consensusrules=rdts"

# the image runs as UID 1000; unlike btcpayserver/bitcoinknots it does not start as root and fix permissions automatically
# set both values to the same UID so the container can read and write /data
pulumi config set bitcoin-knots:runAsUser 1000
pulumi config set bitcoin-knots:volumeOwnerUserId 1000

# (Optional) add more logging to see mempool transaction rejections
pulumi config set bitcoin-knots:debug 'true'
```

If migrating from `btcpayserver/bitcoinknots`, your volume is likely owned by UID 999. To avoid re-downloading the chain, use `runAsUser: 999` and `volumeOwnerUserId: 999` instead, or run a one-time `chown -R 1000:1000 /data` on the volume.

### BIP-110 variant

For example if you decide to run the BIP-110 variant:

```sh
# set custom image location
# sha256 is not required but recommended to ensure image has not been modified
# docker tags are mutable so the repository will return 404 if hash doesn't match
pulumi config set bitcoin-knots:image ghcr.io/retropex/bitcoin:29.3.knots20260210-bip110-v0.4.1@sha256:7115247a71d981b5b17745cd165aea956cfd2efcae789f269a897c9aef2159e2

# where to mount volume, this needs to match VOLUME in Dockerfile (/data by default)
pulumi config set bitcoin-knots:volumePath /data/.bitcoin

# remove "bitcoind" from command, needed when image uses non-standard ENTRYPOINT
pulumi config set bitcoin-knots:command ''
pulumi config set bitcoin-knots:commandArgs ''

# (Optional) add more logging to see mempool transaction rejections
pulumi config set bitcoin-knots:debug 'true'
```

You can find sha256 hash with:

```sh
skopeo inspect docker://ghcr.io/retropex/bitcoin:29.2.knots20251110-bip110-v0.1 | jq .Digest
skopeo inspect docker://bitcoinknots/bitcoin:29.3.knots20260508 | jq .Digest
```
