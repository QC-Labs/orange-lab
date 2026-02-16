#!/bin/bash

# Script to watch all Kubernetes events across all namespaces
# Usage: events

trap "exit" INT TERM

while true; do
  kubectl events -A -w
  echo "*** Connection lost *** Retrying in 5 seconds..."
  sleep 5
done
