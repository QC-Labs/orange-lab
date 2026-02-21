# Technitium DNS

| Resource      | Link                                            |
| ------------- | ----------------------------------------------- |
| Homepage      | https://technitium.com/dns/                     |
| Source code   | https://github.com/TechnitiumSoftware/DnsServer |
| Documentation | https://technitium.com/help/                    |
| Endpoint      | https://dns.<domain>                            |

Technitium DNS Server is an open source authoritative as well as recursive DNS server that can be used for self hosting a DNS server for privacy & security.

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
```
