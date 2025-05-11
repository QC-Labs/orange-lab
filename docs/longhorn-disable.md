# Disabling Longhorn

## Overview

**Note: Longhorn is the recommended storage solution for OrangeLab** as it provides distributed storage, replication, snapshots, and backup capabilities. However, there are specific situations where disabling Longhorn and using simpler storage options makes sense:

1. **Single-node deployments** where distributed storage features are not important
2. **Windows or macOS systems** using k3d, as Longhorn only runs on Linux

For these cases, you can use the `local-path-provisioner` instead. Persistent volumes will be stored in `/var/lib/rancher/k3s/storage`

Be aware of these limitations when not using Longhorn:

-   No storage replication
-   No automatic snapshots or volume repair
-   Backups to S3/MinIO will not be available
-   Data only exists on single host running the pods
-   Pods need to be scheduled on specific node

## Windows and macOS Support

Windows and macOS support is limited:

-   K3s requires Linux to run workloads using _containerd_ directly
-   You could use [k3d](https://k3d.io/) which uses Docker as a wrapper to run containers
-   This setup works for some containers as long as they do not use persistent storage
-   Not a tested configuration, but feedback is welcome

Using k3d, you can run some OrangeLab components, but you will need to set up the single-node configuration as described above because Longhorn only runs on Linux.

For more information on k3d limitations with Longhorn, see: https://github.com/k3d-io/k3d/blob/main/docs/faq/faq.md#longhorn-in-k3d

## Use Local Storage for an Application

To disable Longhorn and use local storage for each application:

```sh
pulumi config set longhorn:enabled false
# Example: Configure Ollama to use local-path storage
pulumi config set ollama:storageClass local-path
pulumi up
```

## Node Selection with Local Storage

When using local storage, you must ensure your application runs on a specific node where the storage is located. For persistent data, set the required node:

```sh
# Run application on a specific node by hostname
pulumi config set ollama:requiredNodeLabel kubernetes.io/hostname=my-server
```

This is critical with local storage since data is only available on the node where it was created.

## SELinux Considerations

On SELinux-enabled systems (like Fedora, RHEL, CentOS), if deployment fails due to directory creation permissions on `/var/lib/rancher/k3s/storage/`, you can temporarily loosen SELinux restrictions:

```sh
sudo setenforce 0
# Run your deployment commands
sudo setenforce 1
```

This applies when using the local-path provisioner.
