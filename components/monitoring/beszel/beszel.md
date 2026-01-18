# Beszel

|           |                                    |
| --------- | ---------------------------------- |
| Homepage  | https://beszel.dev/                |
| Endpoints | `https://beszel.<tsnet>.ts.net/`   |
|           | `https://beszel.<tsnet>.ts.net/_/` |

A lightweight alternative to Prometheus.

First deploy Beszel hub with:

```sh
pulumi config set beszel:enabled true
pulumi up
```

Once the hub is deployed, go to `beszel.<tsnet>.ts.net` endpoint and create an admin account.

To deploy agents you need to find the generated public key. Click `Add system`, then copy the `Public key` field. Close the popup and do not add any systems yet.

You can automatically add all agents by enabling universal token (Settings -> Token & Fingerprints -> Universal token).

```sh
# replace <KEY> with the copied value "ssh-ed25519 ..."
pulumi config set beszel:hubKey <KEY>
# copy universal token from UI so agents can automatically register
pulumi config set beszel:TOKEN <TOKEN> --secret
pulumi up
```

Make sure to allow traffic to agents on port `45876`:

```sh
firewall-cmd --permanent --add-port=45876/tcp
```
