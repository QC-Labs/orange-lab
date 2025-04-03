#!/bin/bash

# Script to quickly access application logs
# Usage: logs <app-name> [namespace]

appName=$1
namespace=${2:-$1}  # app name as namespace if not provided

if [ -z "$appName" ]; then
  echo "Error: Application name is required"
  echo "Usage: logs <app-name> [namespace]"
  exit 1
fi

kubectl logs -f -l app.kubernetes.io/name=$appName -n $namespace --all-containers=true
