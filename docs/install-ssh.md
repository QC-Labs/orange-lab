# SSH connection

This step is **optional**, but makes it easier to login to remote hosts on your Tailscale network as administrator. It's useful when installing/upgrading K3s agents.

The assumption is that you have SSH server enabled (`systemctl enable sshd.service --now`) and you can login using password to a user account created during OS installation.

More info:

- https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent
- https://www.ssh.com/academy/ssh/keygen

## One-time setup (management node)

Let's create a new SSH key and enable key-based authentication for root user. Using passphrase is recommended as this will help with situation when your private key is leaked or copied.
We'll use ssh-agent so you don't have to enter it too often.

```sh
# Generate key (use passphrase when prompted)
ssh-keygen # interactive
ssh-keygen -f ~/.ssh/orangelab -C "user@<domain>"

# Add ssh key to agent
ssh-add ~/.ssh/orangelab

# Confirm the key is available to ssh-agent
ssh-add -l
```

## Per-node setup

Run these commands for every new node you add to the cluster.

### Enable SSH

In the terminal of new node:

```sh
systemctl enable sshd.service --now
```

### Copy key to node

On the admin node:

```sh
# Creates entry in remote ~/.ssh/authorized_keys
ssh-copy-id -i ~/.ssh/orangelab user@<host>
```

Now we can log in to normal user account on remote host using the key. Let's enable root login as well using the same key.

### Enable root login

```sh
# Login as regular user using the SSH key
ssh user@<host>

# Copy authorized_keys from user to root account
sudo cp ~/.ssh/authorized_keys /root/.ssh/authorized_keys
sudo chown root:root /root/.ssh/authorized_keys

# ...or copy last added key only
export LAST_KEY=$(tail -n 1 ~/.ssh/authorized_keys)
sudo echo $LAST_KEY >> /root/.ssh/authorized_keys

# Edit sshd_config and uncomment line permitting root login with keys only
sudo nano /etc/ssh/sshd_config
PermitRootLogin prohibit-password

# Reload SSH daemon
systemctl reload sshd.service

# Log out and test connection to root account
exit
ssh root@<host>
```

Done! You can now SSH to `root@<host>` without password.
