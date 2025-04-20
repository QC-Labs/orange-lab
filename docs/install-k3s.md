# Installation - Kubernetes nodes (K3S)

This document covers K3s installation and configuration. For general node preparation, see [Installation - Node Configuration](./install-nodes.md).

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

## Missing k3s token

If this file is empty or missing, K3s cannot start.

### Generate a New Token with k3s CLI
If the token file is empty or invalid, generate a new one using the built-in k3s token command:

```bash
sudo k3s token generate
```

The expected token file is usually at:
```/var/lib/rancher/k3s/server/token```

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

# Set zone, used f.e. by home-assistant to deploy to node on same network as sensors
kubectl label nodes <node-name> topology.kubernetes.io/zone=home
```

> Note: GPU nodes are automatically detected and labeled by the [Node Feature Discovery](/components/system/SYSTEM.md#node-feature-discovery-nfd) component.
