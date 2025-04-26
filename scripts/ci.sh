#!/usr/bin/env bash
set -eo pipefail

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --deploy)
      OPERATION="deploy"
      shift
      ;;
    *)
      echo "Unknown parameter: $1"
      exit 1
      ;;
  esac
done

# Run Dagger workflow
dagger run node dagger-workflow.ts -- ${OPERATION:+--deploy}

# Post-deployment checks
if [[ "$OPERATION" == "deploy" ]]; then
  echo "Validating deployment..."
  npx pulumi stack output -j | jq -e '.clusterStatus == "active"'
fi
