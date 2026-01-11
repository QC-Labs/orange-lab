#!/bin/bash

# Wrapper for bitcoin-cli to set RPC authentication

ADMINPASSWORD=$(pulumi stack output bitcoin --show-secrets | jq .bitcoinUsers.admin -r)

bitcoin-cli -rpcconnect=bitcoin -rpcuser=admin -rpcpassword="${ADMINPASSWORD}" "${@:---help}"
