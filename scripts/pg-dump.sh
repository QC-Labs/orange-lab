#!/bin/bash

# Script to dump PostgreSQL database from Kubernetes pod
# Usage: pg-dump <app-name> [namespace]

appName=$1
namespace=${2:-$1}  # app name as namespace if not provided

if [ -z "$appName" ]; then
  echo "Error: Application name is required"
  echo "Usage: pg-dump <app-name> [namespace]"
  exit 1
fi

pod="${appName}-db-1"

echo "Dumping database from pod: $pod"
kubectl exec $pod -n $namespace -c postgres -- pg_dump -Fc -d $appName > $appName.dump

if [ $? -eq 0 ]; then
    echo "Database dump completed successfully: $appName.dump"
else
    echo "Error: Database dump failed"
    exit 1
fi
