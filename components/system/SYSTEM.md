# System

Core infrastructure components. These should be deployed first before any other modules.

## Deployment Order

1. **[Network](../network/NETWORK.md)** - Ingress and routing (must be first)
2. **[Storage](../storage/STORAGE.md)** - Distributed storage
3. **[Hardware](../hardware/HARDWARE.md)** - GPU support (if needed)
4. **System** - Debug tools (this module)

## Components

### Experimental

- [Debug](./debug/debug.md) - (Optional, Troubleshooting only) Troubleshooting utilities and volume access tools.
