#!/bin/bash

# Script to quickly access application logs
# Usage: logs <app-name> [namespace]

appName=$1
namespace=${2:-$1}  # app name as namespace if not provided
label=app.kubernetes.io/name

if [ -z "$appName" ]; then
  echo "Error: Application name is required"
  echo "Usage: logs <app-name> [namespace]"
  exit 1
fi

if [[ "$appName" == "open-webui" ]]; then
    label=app.kubernetes.io/component
fi

kubectl logs -f -l $label=$appName -n $namespace --all-containers=true --ignore-errors=true
