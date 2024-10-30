# OrangeLab

Private infrastructure for cloud natives.

# Features

Technology used:

-   Pulumi - configuration management, deployments and infrastructure as code
-   Tailscale - end-to-end encrypted communication between nodes.
-   K3s - lightweight Kubernetes cluster
-   Longhorn - distributed storage

# Prerequisites

```
git clone https://github.com/AdamNowotny/orange-lab.git
brew install pulumi kubectl k9s
flatpak install io.kinvolk.Headlamp
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
firewall-cmd --permanent --zone=internal --add-port=5001/tcp # Spegel (Embedded distributed registry)
firewall-cmd --permanent --zone=internal --add-port=6443/tcp # Spegel (Embedded distributed registry)
firewall-cmd --permanent --add-port=6443/tcp # apiserver
firewall-cmd --reload
```

# Kubernetes (K3S)

## Create cluster

Run the script on _management node_:

```
./scripts/k3s-install-server.sh
```

then copy the contents and run it on the _server node_ to install k3s server and agent.

Make sure the service is running and enabled for reboots:

```
systemctl enable k3s.service --now
```

## Add agent nodes

```
./scripts/k3s-get-credentials.sh
./scripts/k3s-install-agent.sh
```

## Kube config

```
sudo chmod 600 ~/.kube/config
sudo chown $USER ~/.kube/config
sed -i -e "s/127.0.0.1/$HOSTNAME/g" ~/.kube/config
```

# Longhorn

```
systemctl enable iscsid.service --now
systemctl enable iscsid.socket --now
pulumi config set orangelab:modules.longhorn true
pulumi up
```
