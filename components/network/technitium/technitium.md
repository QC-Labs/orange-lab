# Technitium DNS

| Resource      | Link                                            |
| ------------- | ----------------------------------------------- |
| Homepage      | https://technitium.com/dns/                     |
| Source code   | https://github.com/TechnitiumSoftware/DnsServer |
| Documentation | https://technitium.com/help/                    |
| Endpoint      | https://dns.<domain>                            |

Technitium DNS Server is an open source authoritative as well as recursive DNS server that can be used for self hosting a DNS server for privacy & security.

## Prerequisites

Before deploying Technitium, configure systemd-resolved to free up port 53:

```sh
sudo mkdir -p /etc/systemd/resolved.conf.d/
sudo tee /etc/systemd/resolved.conf.d/dns.conf <<EOF
[Resolve]
DNS=1.1.1.1 # default to CloudFlare DNS instead of ISP DNS assigned by DHCP
DNSStubListener=no # release DNS port
EOF
sudo systemctl restart systemd-resolved

# Verify port 53 is free (should not show 127.0.0.53:53)
ss -tlnp | grep ':53'
```

## Features

- Authoritative and recursive DNS server
- Built-in ad blocking (similar to Pi-hole)
- DNS-over-TLS (DoT) and DNS-over-HTTPS (DoH) support
- Web-based management interface
- Custom DNS zones and conditional forwarding

## Quick start

```sh
# Required
technitium:enabled: true

# (Optional) Hostname for web UI access (default: dns)
technitium:hostname: dns

# (Optional) Storage size for configuration (default: 5Gi)
technitium:storageSize: 5Gi

# (Optional) DNS forwarders - comma-separated list
# Leave empty or unset to use root DNS servers (default)
technitium:forwarders: "1.1.1.1,8.8.8.8"
```

## Tailscale DNS Configuration

To use Technitium for all DNS queries across your Tailnet:

1. Open [Tailscale Admin Console](https://login.tailscale.com/admin/dns)
2. Navigate to **Nameservers** section
3. Click **Add nameserver** → **Custom**
4. Enter your node's IP address (e.g., `100.x.x.x` - Tailscale IP of host running Technitium)
5. Enable **"Use with Exit node"** option
6. Enable **"Override local DNS"** to use Technitium for all queries, even outside Tailnet

This routes all DNS queries from Tailscale clients through Technitium, enabling:

- Ad-blocking across all Tailscale devices
- Custom DNS zones
- Local domain resolution
- DNS queries caching
