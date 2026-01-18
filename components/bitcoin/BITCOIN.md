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

## Components

- [Bitcoin Knots](./bitcoin-knots/bitcoin-knots.md) - A conservative fork of Bitcoin Core focused on stability and improvements.
- [Bitcoin Core](./bitcoin-core/bitcoin-core.md) - The reference implementation of the Bitcoin protocol.
- [Electrs](./electrs/electrs.md) - Efficient Electrum Server implementation for wallet synchronization.
- [Mempool](./mempool/mempool.md) - Full-stack block explorer and visualization tool.
