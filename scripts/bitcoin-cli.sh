#!/bin/bash

# Wrapper for bitcoin-cli to set RPC authentication

# Get Bitcoin RPC endpoint (supports both bitcoin-knots and bitcoin-core)
RPC_ENDPOINT=$(pulumi stack output bitcoin | jq -r '.endpoints["bitcoin-knots-rpc"] // .endpoints["bitcoin-core-rpc"]')

# Get admin password (requires --show-secrets)
ADMINPASSWORD=$(pulumi stack output bitcoin --show-secrets | jq -r '.bitcoinUsers.admin')

bitcoin-cli -rpcconnect="${RPC_ENDPOINT%%:*}" -rpcport="${RPC_ENDPOINT##*:}" -rpcuser=admin -rpcpassword="${ADMINPASSWORD}" "${@:---help}"
