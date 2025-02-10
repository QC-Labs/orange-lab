# Installation - Kubernetes nodes (K3S)

## Firewall

Setup firewall rules on k3s server and worker nodes:

```sh
firewall-cmd --permanent --add-source=10.42.0.0/16 # Pods
firewall-cmd --permanent --add-source=10.43.0.0/16 # Services
firewall-cmd --permanent --add-port=6443/tcp # API Server
firewall-cmd --permanent --add-port=10250/tcp # Kubelet metrics
firewall-cmd --permanent --add-port=9100/tcp # Prometheus metrics
firewall-cmd --permanent --add-port=45876/tcp # Beszel metrics
systemctl reload firewalld
```

In case of connectivity issues, try disabling the firewall:

```sh
systemctl disable firewalld.service --now
```

## (Optional) Disable suspend on laptops

To disable suspend mode when laptop lid is closed, edit `/etc/systemd/logind.conf` and uncomment these lines

```conf
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
```

Turn off suspend mode when on AC power. The setting in Gnome UI (Settings -> Power -> Automatic Suspend -> "When Plugged In") only applies when you're logged in, but not on login screen. You can check current settings with:

```sh
# Check current settings
sudo -u gdm dbus-run-session gsettings list-recursively org.gnome.settings-daemon.plugins.power | grep sleep

# Output example: org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 900

# Disable suspend mode on AC power:
sudo -u gdm dbus-run-session gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 0
```

# Installation - K3S server

Server has to be installed before any other nodes can be added.

Kubernetes server should be installed on a machine that's online 24/7 but it's not required - running everything on a single laptop is fine too, however the availability of services will be limited.

Installing server will also run an agent node on the same machine.

## K3S server

`k3s-server.sh` executed on _management node_ generates script to install K3S on _server node_:

```sh
# localhost
./scripts/k3s-server.sh | sh

# SSH remote node
./scripts/k3s-server.sh # run on management node, copy the generated script
ssh root@<server-node> # paste generated script to install K3S
```

Make sure the service is running and enabled on startup:

```sh
systemctl enable k3s.service --now
```

## Save server configuration

Add the tailscale IP of the server to Pulumi configuration:

```sh
# localhost
pulumi config set k3s:serverIp $(tailscale ip -4)

# Remote host. Find IP with 'tailscale status'
pulumi config set k3s:serverIp <server_ip>
```

Add generated agent token to Pulumi configuration as secret:

```sh
# localhost
export K3S_TOKEN=$(sudo cat /var/lib/rancher/k3s/server/node-token)

 # SSH remote node
export K3S_TOKEN=$(ssh root@<node> cat /var/lib/rancher/k3s/server/node-token)

pulumi config set k3s:agentToken $K3S_TOKEN --secret
```

## Kube config for admin

```sh
# copy kubeconfig from server to your management node
scp <user>@<k8s-server>:.kube/config ~/.kube/config
```

# Installation - K3S agents

Install K3S agent nodes on any additional physical hardware. Server already runs an agent.

## K3S agent

`k3s-agent.sh` executed on _management node_ generates script to install K3S on _agent node_:

```sh
# localhost
./scripts/k3s-agent.sh | sh

# SSH remote node
./scripts/k3s-agent.sh # run on management node, copy the generated script
ssh root@<agent-node> # paste generated script to install K3s
```

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
