# Installation - Kubernetes nodes (K3S)

This document covers K3s installation and configuration. For general node preparation, see [Installation - Node Configuration](./install-nodes.md).

# Installation - K3S server

Server has to be installed before any other nodes can be added.

Kubernetes server should be installed on a machine that's online 24/7 but it's not required - running everything on a single laptop will work, however the availability of services will be limited.

Installing server will also run an agent node on the same machine.

## K3S server

`k3s-server.sh` executed on _management node_ generates script to install K3S on _server node_:

```sh
# Run where Pulumi is installed
./scripts/k3s-server.sh

# Copy the generated script

# Login to server node and paste generated script:
ssh root@<server-node>
```

Check is the service is running:

```sh
systemctl status k3s.service
```

The server should also create two files:

- `/var/lib/rancher/k3s/server/token` - server token, needed by agents to connect
- `/etc/rancher/k3s/k3s.yaml` - kubeconfig file, copy to your `~/.kube/config`

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
scp <user>@<k8s-server>:/etc/rancher/k3s/k3s.yaml ~/.kube/config
```

# Installation - K3S agents

Install K3S agent nodes on any additional physical hardware. Server already runs an agent.

## K3S agent

`k3s-agent.sh` executed on _management node_ generates script to install K3S on _agent node_:

```sh
# Run where Pulumi is installed
./scripts/k3s-agent.sh

# Copy the generated script

# Login to agent node and paste generated script:
ssh root@<agent-node>
```

Check is the service is running:

```sh
systemctl status k3s-agent.service
```

## Node labels

You can set node labels later when installing applications. Examples:

```sh
# Storage node used by Longhorn, at least one is needed
kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true

# Set zone, used f.e. by home-assistant to deploy to node on same network as sensors
kubectl label nodes <node-name> topology.kubernetes.io/zone=home
```

> Note: GPU nodes are automatically detected and labeled by the [Node Feature Discovery](/components/system/nfd/nfd.md) component.
