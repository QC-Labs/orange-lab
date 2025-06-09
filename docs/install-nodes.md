# Installation - Node Configuration

This document covers general node configuration that should be done before installing K3s.

## Firewall

Setup firewall rules on k3s server and worker nodes:

```sh
firewall-cmd --permanent --add-source=10.42.0.0/16 # Pods
firewall-cmd --permanent --add-source=10.43.0.0/16 # Services
firewall-cmd --permanent --add-port=6443/tcp # API Server
firewall-cmd --permanent --add-port=10250/tcp # Kubelet metrics
firewall-cmd --permanent --add-port=9100/tcp # Prometheus metrics
firewall-cmd --permanent --add-port=45876/tcp # Beszel metrics
firewall-cmd --permanent --add-port=41641/tcp # Tailscale UDP
systemctl reload firewalld
```

In case of connectivity issues, try disabling the firewall:

```sh
systemctl disable firewalld.service --now
```

## (Recommended) Disable swap

It's recommended to disable swap memory when running Kubernetes as this helps with scheduling and reporting correct amount of resources available.

```sh
sudo swapoff -a
sudo systemctl mask dev-zram0.swap

# confirm swap is disabled
free -h
```

## (Optional) Disable suspend

### Server

```sh
# Disable all sleep modes
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

### Laptop

#### Ignore lid close

To disable suspend mode when laptop lid is closed while on AC power, edit `/etc/systemd/logind.conf` and uncomment these lines

```conf
HandleLidSwitch=suspend
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
```

If the file doesn't exist, copy it `cp /usr/lib/systemd/logind.conf /etc/systemd/` then edit.

Restart service with `sudo systemctl reload systemd-logind.service`

#### Don't suspend when on AC power

Turn off suspend mode when on AC power. The setting in Gnome UI (Settings -> Power -> Automatic Suspend -> "When Plugged In") only applies when you're logged in, but not on login screen. You can check current settings with:

```sh
# Check current settings
sudo -u gdm dbus-run-session gsettings list-recursively org.gnome.settings-daemon.plugins.power | grep sleep

# Output example: org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 900

# Disable suspend mode on AC power:
sudo -u gdm dbus-run-session gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 0
```
