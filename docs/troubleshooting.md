# Troubleshooting

It's easiest to use _Headlamp_ or _k9s_ to connect to cluster. Below are some useful commands when troubleshooting issues.

```sh
# Check logs of the app, namespace optional if same as app name
./scripts/logs.sh <app> [namespace]

# Watch cluster events
kubectl events -A -w

# See all application resources
kubectl get all -n <namespace>
```

Pods can be stopped and will be recreated automatically.

You can shut down the application resources, then recreate them. Note that if storage is removed then configuration will be lost and some data might need to be downloaded again (for example LLM models)

## HTTPS endpoint

In case of issues connecting to the HTTPS endpoint, try connecting to the Kubernetes service directly, bypassing the Ingress and Tailscale `ts-*` proxy pod:

```sh
# Find cluster IP address and port of the service
kubectl get svc -n <app>

# Test connection or use browser (note services do not use HTTPS, only Ingress)
curl http://<ip>:<port>/
telnet <ip> <port>
```

If that works, then Tailscale Ingress needs to be looked at. Try stopping the `ts-*` proxy pod, it will be recreated. Remember that first time you access an endpoint, the HTTPS certificate is provisioned and that can take up to a minute.

Make sure there is no leftover entry for a service at https://login.tailscale.com/admin/machines. If there is a conflicting entry, remove it before enabling the app again (specifically the Ingress resource managed by Tailscale operator).

## Longhorn

Longhorn troubleshooting guide - https://github.com/longhorn/longhorn/wiki/Troubleshooting

Cheatsheet with useful commands - https://support.tools/training/longhorn/troubleshooting/
