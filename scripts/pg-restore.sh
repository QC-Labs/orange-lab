#!/bin/bash

# Script to restore PostgreSQL database to Kubernetes pod
# Usage: pg-restore <app-name> [namespace]

appName=$1
namespace=${2:-$1}  # app name as namespace if not provided

if [ -z "$appName" ]; then
  echo "Error: Application name is required"
  echo "Usage: pg-restore <app-name> [namespace]"
  exit 1
fi

# Check if dump file exists
if [ ! -f "$appName.dump" ]; then
    echo "Error: Dump file '$appName.dump' not found"
    echo "Please run 'pg-dump $appName' first to create the dump file"
    exit 1
fi

pod="${appName}-db-1"

echo "Restoring database to pod: $pod"
kubectl exec -i $pod -n $namespace -c postgres -- pg_restore --no-owner --role=$appName -d $appName --verbose < $appName.dump

if [ $? -eq 0 ]; then
    echo "Database restore completed successfully"
else
    echo "Error: Database restore failed"
    exit 1
fi
