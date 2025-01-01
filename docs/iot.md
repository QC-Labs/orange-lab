# IoT (Internet of Things)

## Home Assistant

Using zone is optional, but helps with making sure the application is deployed on same network as the sensors.

```sh
kubectl label nodes <node-name> topology.kubernetes.io/zone=home

pulumi config set orangelab:home-assistant true
pulumi config home-assistant:zone home
```
