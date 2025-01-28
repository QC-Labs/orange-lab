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
