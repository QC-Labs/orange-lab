# Installation - management node

Management node is where you run Pulumi, most likely your laptop.

```sh
git clone https://github.com/QC-Labs/orange-lab
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
brew install node pulumi kubectl k9s
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

Add tags to your Tailnet ACLs (https://login.tailscale.com/admin/acls/file):

```json
"tagOwners": {
    "tag:k8s-server":   [],
    "tag:k8s-agent":    [],
}
```

Create Tailscale API access token for Pulumi (https://login.tailscale.com/admin/settings/keys) and add it to `Pulumi.<stack>.yaml` with:

```sh
pulumi config set tailscale:apiKey <TAILSCALE_API_KEY> --secret
pulumi config set tailscale:tailnet <TAILSCALE_TAILNET>
pulumi up
```

Enable MagicDNS and HTTPS certificates on https://login.tailscale.com/admin/dns
