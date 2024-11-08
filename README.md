# OrangeLab

Private infrastructure for cloud natives.

# Features

Technology used:

-   Pulumi (https://www.pulumi.com/) - configuration management, deployments and infrastructure as code
-   Tailscale (https://tailscale.com/) - end-to-end encrypted communication between nodes
-   K3s (https://k3s.io/) - lightweight Kubernetes cluster
-   Longhorn (https://longhorn.io/) - distributed storage

# Prerequisites

```
git clone https://github.com/AdamNowotny/orange-lab.git
brew install pulumi kubectl k9s
flatpak install io.kinvolk.Headlamp
```

Open project in VSCode, make sure you have DevContainers extension installed (https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

To have access to your Tailscale network inside VS terminal run following commands. Feel free to change the hostname to whatever you want to call it:

```
sudo tailscale login
sudo tailscale up --accept-routes --hostname <user>-vscode
```

# Pulumi

Create Pulumi access token at https://app.pulumi.com/account/tokens

```
pulumi login
pulumi stack init <stack-name> # first run only
pulumi stack select <stack-name>
```

# Tailscale

Create Tailscale API access token for Pulumi (https://login.tailscale.com/admin/settings/keys) and add the secrets to `Pulumi.<stack>.yaml` with:

```
pulumi config set tailscale:apiKey <TAILSCALE_API_KEY> --secret
pulumi config set tailscale:tailnet <TAILSCALE_TAILNET>
pulumi up
```

# Firewall

```
firewall-cmd --permanent --zone=trusted --add-source=10.42.0.0/16 # pods
firewall-cmd --permanent --zone=trusted --add-source=10.43.0.0/16 # services
firewall-cmd --permanent --zone=internal --add-port=10250/tcp # Kubelet metrics
firewall-cmd --permanent --zone=internal --add-port=9100/tcp # Prometheus metrics
firewall-cmd --permanent --zone=internal --add-port=5001/tcp # Spegel (Embedded distributed registry)
firewall-cmd --permanent --zone=internal --add-port=6443/tcp # Spegel (Embedded distributed registry)
firewall-cmd --permanent --add-port=6443/tcp # apiserver
firewall-cmd --reload
```

# Kubernetes (K3S)

## Create cluster

Run the script on _management node_:

```
./scripts/k3s-server.sh
```

then copy the contents and run it on the _server node_ to install k3s server and agent.

Make sure the service is running and enabled for reboots:

```
systemctl enable k3s.service --now
```

## Save server configuration

Add the tailscale IP of the server to Pulumi configuration:

```
pulumi config set k3s:serverIp <server_ip>
pulumi config set k3s:serverIp $(tailscale ip -4) # for localhost
```

Add generated agent token to Pulumi configuration as secret:

```
K3S_TOKEN=$(ssh user@serverIp sudo cat /var/lib/rancher/k3s/server/node-token) # remote by SSH
K3S_TOKEN=$(cat /var/lib/rancher/k3s/server/node-token) # localhost
pulumi config set k3s:agentToken $K3S_TOKEN --secret
```

## Add agent nodes

```
./scripts/k3s-agent.sh
```

## Disable suspend

Turn off suspend mode when on AC power. The setting in Gnome UI only applies when you're logged in, but not on login screen. You can check current settings with:

```
# Check current settings
sudo -u gdm dbus-run-session gsettings list-recursively org.gnome.settings-daemon.plugins.power | grep sleep

# Disable suspend mode on AC power:
sudo -u gdm dbus-run-session gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 0
```

## Kube config

```
scp <user>@<k8s-server>:~/.kube/config ~/.kube/config
```

# Tailscale-operator

Add `k8s-operator` and `k8s` tags.
Create OAuth client for tailscale-operator with write permissions to devices.
https://tailscale.com/learn/managing-access-to-kubernetes-with-tailscale#preparing-the-operator

```
pulumi config set orangelab:tailscale-operator true
pulumi config set tailscale-operator:oauthClientId <OAUTH_CLIENT_ID> --secret
pulumi config set tailscale-operator:oauthClientSecret <OAUTH_CLIENT_SECRET> --secret
```

Before running `pulumi up` make sure you have HTTPS enabled on your tailnet (https://login.tailscale.com/admin/dns).

## Kubernetes API access

After deploying the operator, you can use new endpoint for Kubernetes API, https://tailscale-operator.<tailnet>.ts.net

Permissions are managed in Tailscale so make sure you enable admins access to the cluster in your Tailscale ACLs:

```
"grants": [{
    "src": ["autogroup:admin"],
    "dst": ["tag:k8s-operator"],
    "app": {
        "tailscale.com/cap/kubernetes": [{
            "impersonate": {
                "groups": ["system:masters"],
            },
        }],
    },
}]
```

From now on, to generate `~/.kube/config` to access Kubernetes API, just run this command

```
tailscale configure kubeconfig tailscale-operator
```

# Longhorn

````

systemctl enable iscsid.service --now
systemctl enable iscsid.socket --now
pulumi config set orangelab:modules.longhorn true
pulumi up

```

## Uninstall

https://artifacthub.io/packages/helm/longhorn/longhorn#uninstallation

```

kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag

```

# Prometheus

```

pulumi config set prometheus.enabled true
pulumi up

```

```
````
