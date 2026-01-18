# AMD GPU operator

|                  |                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------- |
| Homepage         | https://github.com/ROCm/gpu-operator                                                |
| Docs             | https://instinct.docs.amd.com/projects/gpu-operator                                 |
| Helm values      | https://github.com/ROCm/gpu-operator/blob/main/helm-charts/values.yaml              |
| DeviceConfig ref | https://instinct.docs.amd.com/projects/gpu-operator/en/latest/fulldeviceconfig.html |

This component is needed to run GPU workloads using AMD devices with ROCm support.

```sh
# Enable automatic GPU detection with NFD
pulumi config set nfd:enabled true

# Enable AMD GPU operator
pulumi config set amd-gpu-operator:enabled true

pulumi up
```

For applications like Ollama using AMD GPUs, you may need to set `amd-gpu` to true as the docker images used are different:

```sh
pulumi config set ollama:amd-gpu true
```

For detailed information, see the [AMD GPU Guide](/docs/amd-gpu.md).

## Uninstall

For detailed uninstallation instructions, see the [official documentation](https://instinct.docs.amd.com/projects/gpu-operator/en/latest/uninstallation/uninstallation.html).

```sh
pulumi config set amd-gpu-operator:enabled false
pulumi up

kubectl delete crds deviceconfigs.amd.com \
    modules.kmm.sigs.x-k8s.io \
    nodemodulesconfigs.kmm.sigs.x-k8s.io \
    preflightvalidations.kmm.sigs.x-k8s.io
```
