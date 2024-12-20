# OrangeLab

Private infrastructure for cloud natives.

Core components:

-   Pulumi (https://www.pulumi.com/) - configuration management, deployments and infrastructure as code
-   Tailscale (https://tailscale.com/) - end-to-end encrypted communication between nodes
-   K3s (https://k3s.io/) - lightweight Kubernetes cluster
-   Longhorn (https://longhorn.io/) - distributed storage

Applications (optional, enable with `orangelab:<app>` feature flags in `Pulumi.<stack>.yaml`):

-   `prometheus` - Prometheus/Grafana (https://prometheus.io/) monitoring
-   `home-assistant` - Home Assistant (https://www.home-assistant.io/) home automation platform
-   `ollama` - Ollama API (https://ollama.com/) local large language models
-   `open-webui` - Open WebUI (https://openwebui.com/) frontend

Principles and goals:

-   decentralized - uses your physical machines potentially spread out over geographical locations, minimise dependency on external services and cloud providers
-   private by default - uses Tailscale/WireGuard for end to end encrypted communication, making services public has to be explicitly defined
-   OSS - prefer open source components that can be run locally
-   automation - use Pulumi and Helm to automate most tasks and configuration
-   easy to use - no deep Kubernetes knowledge required, sensible defaults
-   offline mode - continue working (with some limitations) over local network when internet connection lost
-   lightweight - can be run on a single laptop
-   scalable - distribute workloads across multiple machines as they become available, optional use of cloud instances for autoscaling
-   self-healing - in case of problems, the system should recover with no user intervention
-   immutable - no snowflakes, as long as there is at least one Longhorn replica available, components can be destroyed and easily recreated

# Platforms and limitations

Installation instructions assume your machines are running Bluefin (https://projectbluefin.io/) based on Fedora Silverblue unless otherwise noted.
It should run on any modern Linux distribution with Linux kernel 6.11.6+, even including Raspberry Pi.

Windows and MacOS are not currently supported. K3s requires Linux to run workloads using _containerd_ directly, however you could have some luck running https://k3d.io/ which uses Docker wrapper to run some containers as long as they do not use persistent storage.
Not a tested configuration but feedback welcome. The issue is Longhorn, which only runs on Linux. More info at https://github.com/k3d-io/k3d/blob/main/docs/faq/faq.md#longhorn-in-k3d

# Usage

There are some manual steps required for initial cluster setup and when adding new nodes.

Once that's done, infrastructure can be updated with:

```sh
# update Pulumi.<stack>.yaml to configure modules
pulumi up
pulumi up -r # --refresh Pulumi state if out of sync
```

Services have endpoints at `https://<service>.<tailnet>.ts.net/`

# Installation - management node

Management node is where you run Pulumi, most likely your laptop.

```sh
git clone https://github.com/AdamNowotny/orange-lab.git
```

## Prerequisites - DevContainers (VSCode)

_This method is recommended for new users as it doesn't require installing dependencies.
After each container rebuild, Tailscale and Pulumi has to be setup again so you might want to switch to manual method later._

Make sure you have DevContainers extension installed (https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

Open project in VSCode. It will install the required dependencies. You can then use the terminal to run commands.

To have access to your Tailscale network inside VS terminal run following command. Change the hostname to whatever you want to call it. Make sure the name doesn't exist yet:

```sh
# This needs to be run after each container rebuild
sudo tailscale up --accept-routes --hostname <user>-vscode
```

## Prerequisites - Manual

Install dependencies on the management node (where you run Pulumi):

```sh
brew install node pulumi kubectl helm k9s
flatpak install io.kinvolk.Headlamp
sudo tailscale up --operator=$USER --accept-routes
```

## Pulumi

Create Pulumi access token at https://app.pulumi.com/account/tokens

```sh
pulumi login
pulumi stack init <stack-name>
pulumi stack select <stack-name>
```

## Tailscale

Add tags to your Tailnet in ACLs (https://login.tailscale.com/admin/acls/file):

```json
"tagOwners": {
    "tag:k8s-server":   [],
    "tag:k8s-agent":    [],
}
```

Create Tailscale API access token for Pulumi (https://login.tailscale.com/admin/settings/keys) and add the secrets to `Pulumi.<stack>.yaml` with:

```sh
pulumi config set tailscale:apiKey <TAILSCALE_API_KEY> --secret
pulumi config set tailscale:tailnet <TAILSCALE_TAILNET>
pulumi up
```

Enable MagicDNS and HTTPS certificates on https://login.tailscale.com/admin/dns

# Installation - Kubernetes nodes (K3S)

## Firewall

Setup firewall rules on k3s server and worker nodes:

```sh
firewall-cmd --permanent --add-source=10.42.0.0/16 # Pods
firewall-cmd --permanent --add-source=10.43.0.0/16 # Services
firewall-cmd --permanent --add-port=6443/tcp # API Server
firewall-cmd --permanent --add-port=10250/tcp # Kubelet metrics
firewall-cmd --permanent --add-port=9100/tcp # Prometheus metrics
firewall-cmd --permanent --add-port=5001/tcp # Spegel (Embedded distributed registry)
firewall-cmd --permanent --add-port=6443/tcp # Spegel (Embedded distributed registry)
systemctl reload firewalld
```

In case of connectivity issues, try disabling the firewall:

```sh
systemctl disable firewalld.service --now
```

## (Optional) Disable suspend on laptops

Turn off suspend mode when on AC power. The setting in Gnome UI only applies when you're logged in, but not on login screen. You can check current settings with:

```sh
# Check current settings
sudo -u gdm dbus-run-session gsettings list-recursively org.gnome.settings-daemon.plugins.power | grep sleep

# Disable suspend mode on AC power:
sudo -u gdm dbus-run-session gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 0
```

# Installation - K3S server

Server has to be installed before any other nodes can be added.

It is recommended that the Kubernetes server is installed on a machine that's online 24/7 but it's not required - running everything on a single laptop is fine too, however the availability of services will be limited.

Installing server will also run an agent node on the same machine.

## K3S server

Run the script on _management node_:

```sh
./scripts/k3s-server.sh
```

then copy the contents and run it on the _server node_ to install k3s server and agent.

Make sure the service is running and enabled on startup:

```sh
systemctl enable k3s.service --now
```

## Save server configuration

Add the tailscale IP of the server to Pulumi configuration:

```sh
pulumi config set k3s:serverIp <server_ip>
pulumi config set k3s:serverIp $(tailscale ip -4) # localhost
```

Add generated agent token to Pulumi configuration as secret:

```sh
ssh <user>@<k8s-server>
sudo cat /var/lib/rancher/k3s/server/node-token

K3S_TOKEN=<token> # copy from server node
pulumi config set k3s:agentToken $K3S_TOKEN --secret
```

## Kube config for admin

```
rm -f ~/.kube/config
scp <user>@<k8s-server>:.kube/config ~/.kube/config
```

# Installation - K3S agents

Install K3S agent nodes on any additional physical hardware. Server already runs an agent.

It is recommended but not required that they will be online all the time.

## K3S agent

Run the script on _management node_:

```sh
./scripts/k3s-agent.sh
```

then copy the contents and run it on the _agent node_ to install k3s agent.

Make sure the service is running and enabled on startup:

```sh
systemctl enable k3s-agent.service --now
```

## Node labels

You can set node labels later when installing applications. Examples:

```sh
# Storage node used by Longhorn, at least one is needed
kubectl label nodes <node-name> orangelab/storage=true

# GPU node for Ollama
kubectl label nodes <node-name> orangelab/gpu=true

# Set zone, used f.e. by home-assistant to deploy to node on same network as sensors
kubectl label nodes <node-name> topology.kubernetes.io/zone=home
```

# Installation - system applications

## Tailscale-operator

The operator manages Ingress endpoints and load balancers on Tailnet as well as adds Tailscale authenticated Kubernetes API endpoint.

Add `k8s-operator` and `k8s` tags to your Tailnet in ACLs (https://login.tailscale.com/admin/acls/file):

```json
"tagOwners": {
    "tag:k8s-operator": [],
    "tag:k8s":          ["tag:k8s-operator"],
}
```

Create OAuth client for tailscale-operator with write permissions to devices.
https://tailscale.com/learn/managing-access-to-kubernetes-with-tailscale#preparing-the-operator

```sh
pulumi config set tailscale-operator:oauthClientId <OAUTH_CLIENT_ID> --secret
pulumi config set tailscale-operator:oauthClientSecret <OAUTH_CLIENT_SECRET> --secret
pulumi config set orangelab:tailscale-operator true
```

### Kubernetes API access

After deploying the operator, you can use new endpoint for Kubernetes API, https://k8s.<tailnet>.ts.net

Permissions are managed in Tailscale so make sure you enable admin access to the cluster in your Tailscale ACLs:

```json
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

From now on, instead of copying the admin `~/.kube/config` from K3S server, you can use:

```sh
tailscale configure kubeconfig k8s
```

## Longhorn

Enable iSCSI service before deploying Longhorn.

```sh
# Add tag to storage nodes that will be used by Longhorn
kubectl label nodes <node-name> orangelab/storage=true

# Enable iSCSI on each Longhorn node
systemctl enable iscsid.service --now
systemctl enable iscsid.socket --now

# Enable module
pulumi config set orangelab:longhorn true
pulumi up

```

### Uninstall

https://artifacthub.io/packages/helm/longhorn/longhorn#uninstallation

```sh
kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag
```

# Applications

## Prometheus

```sh
pulumi config set prometheus.enabled true
pulumi up
```

## Home Assistant

Using zone is optional, but helps with making sure the application is deployed on same network as the sensors.

```sh
kubectl label nodes <node-name> topology.kubernetes.io/zone=home

pulumi config set orangelab:home-assistant true
pulumi config home-assistant:zone home
```

## Ollama

```sh
# Enable NVidia integration
pulumi config set orangelab:nvidia-gpu-operator true

# API Endpoint at https://ollama.<tsnet>.ts.net
pulumi config set orangelab:ollama true
```

### Ollama CLI

Set CLI to use our `ollama` endpoint instead of the default `localhost:11434`:

```sh
echo export OLLAMA_HOST=https://ollama.<tsnet>.ts.net/ > ~/.bashrc.d/ollama
```

Models will be stored on Longhorn volume.

Increase `longhorn:gpuReplicaCount` to replicate volume across nodes with `orangelab/storage=true` and `orangelab/gpu=true` labels

```sh
ollama pull llama3.2
```

### Open-WebUI

```sh
# Endpoint at https://webui.<tsnet>.ts.net
pulumi config set orangelab:open-webui true
```
