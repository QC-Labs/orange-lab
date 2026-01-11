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
sudo tailscale up --operator=$USER --accept-routes
```

### Tags

Add tag to your Tailnet ACLs (https://login.tailscale.com/admin/acls/file)

```json
"tagOwners": {
    "tag:orangelab":   [],
}
```

### OAuth token

Create Tailscale OAuth token for OrangeLab (https://login.tailscale.com/admin/settings/trust-credentials)

<img src="./tailscale-oauth.png" alt="New Tailscale OAuth token screen" style="width:50%;border:1px solid orange;margin-bottom:1em;" />

Make sure token has write permissions for `Devices/Core` and `Keys/Auth keys`.

Assign `orangelab` tag as well.

<img src="./tailscale-oauth-devices.png" alt="New Tailscale OAuth devices permission" style="width:50%;border:1px solid orange;margin-bottom:1em;" />

Add the token values to `Pulumi.<stack>.yaml`.

You can find Tailnet DNS name at https://login.tailscale.com/admin/dns

```sh
pulumi config set tailscale:tailnet <*.ts.net*>
pulumi config set tailscale:oauthClientId <OAUTH_CLIENT_ID>
pulumi config set tailscale:oauthClientSecret <OAUTH_CLIENT_SECRET> --secret

pulumi up
```

Enable MagicDNS and HTTPS certificates on https://login.tailscale.com/admin/dns
