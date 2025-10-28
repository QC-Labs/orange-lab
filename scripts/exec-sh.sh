#!/bin/bash

# Script to exec into application container
# Usage: exec <app-name> [namespace]

appName=$1
namespace=${2:-$1}  # app name as namespace if not provided
label=app.kubernetes.io/name

if [ -z "$appName" ]; then
  echo "Error: Application name is required"
  echo "Usage: exec <app-name> [namespace]"
  exit 1
fi

if [[ "$appName" == "open-webui" ]]; then
    label=app.kubernetes.io/component
fi

# Get the first pod name
pod=$(kubectl get pods -l $label=$appName -n $namespace -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$pod" ]; then
  echo "Error: No pod found for app $appName in namespace $namespace"
  exit 1
fi

kubectl exec -it $pod -n $namespace -- /bin/bash