# Installation - management node

Management node is where you run Pulumi, most likely your laptop.

```sh
git clone https://github.com/QC-Labs/orange-lab
```

## Prerequisites - DevContainers (VSCode)

_This method is recommended for new users as it doesn't require installing dependencies._

Make sure you have DevContainers extension installed (https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

Open project in VSCode. It will install the required dependencies and recommended extensions. You can then use the terminal inside VSCode to run commands.

## Prerequisites - Manual

Install dependencies on the management node:

```sh
# Install required packages
brew install node pulumi kubectl
# (Recommended) Install development packages
brew install kubectl-cnpg k9s opencode
flatpak install io.kinvolk.Headlamp
flatpak install io.beekeeperstudio.Studio

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

### Clients

Start Tailscale service on each node

```sh
sudo tailscale up  --reset --operator=$USER --accept-routes

# (Optional) Also allow the host to be used as exit node
sudo tailscale up  --reset --operator=$USER --accept-routes --advertise-exit-node
```

For cluster-wide Tailscale integration and ingress support, see the [Tailscale Operator Guide](/components/system/tailscale/tailscale.md).
