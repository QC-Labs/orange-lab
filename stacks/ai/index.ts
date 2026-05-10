import { config } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';
import { Automatic1111 } from './apps/automatic1111/automatic1111';
import { InvokeAi } from './apps/invokeai/invokeai';
import { KubeAi } from './apps/kubeai/kubeai';
import { N8n } from './apps/n8n/n8n';
import { Ollama } from './apps/ollama/ollama';
import { OpenWebUI } from './apps/open-webui/open-webui';
import { SDNext } from './apps/sdnext/sdnext';

const ai = new pulumi.ComponentResource('orangelab:ai', 'ai', {});

const ollama = config.isEnabled('ollama')
    ? new Ollama('ollama', { parent: ai })
    : undefined;

const automatic1111 = config.isEnabled('automatic1111')
    ? new Automatic1111('automatic1111', { parent: ai })
    : undefined;

const sdnext = config.isEnabled('sdnext')
    ? new SDNext('sdnext', { parent: ai })
    : undefined;

const kubeAI = config.isEnabled('kubeai')
    ? new KubeAi('kubeai', { parent: ai })
    : undefined;

const openWebUI = config.isEnabled('open-webui')
    ? new OpenWebUI(
          'open-webui',
          {
              ollamaUrl: ollama?.serviceUrl,
              openAiUrl: kubeAI?.serviceUrl,
              automatic1111Url:
                  sdnext?.app.network.clusterEndpoints.sdnext ??
                  automatic1111?.app.network.clusterEndpoints.automatic1111,
          },
          {
              parent: ai,
              dependsOn: [ollama, kubeAI, automatic1111].filter(x => x !== undefined),
          },
      )
    : undefined;

const invokeAi = config.isEnabled('invokeai')
    ? new InvokeAi('invokeai', { parent: ai })
    : undefined;

const n8n = config.isEnabled('n8n')
    ? new N8n('n8n', { ollamaUrl: ollama?.serviceUrl }, { parent: ai })
    : undefined;

export const endpoints = {
    ...automatic1111?.app.network.endpoints,
    ...invokeAi?.app.network.endpoints,
    kubeai: kubeAI?.endpointUrl,
    ollama: ollama?.endpointUrl,
    'open-webui': openWebUI?.endpointUrl,
    ...sdnext?.app.network.endpoints,
    ...n8n?.app.network.endpoints,
};

export const clusterEndpoints = {
    ...automatic1111?.app.network.clusterEndpoints,
    ...invokeAi?.app.network.clusterEndpoints,
    kubeai: kubeAI?.serviceUrl,
    ollama: ollama?.serviceUrl,
    ...sdnext?.app.network.clusterEndpoints,
    ...n8n?.app.network.clusterEndpoints,
};

export const n8nConfig = n8n
    ? {
          encryptionKey: n8n.encryptionKey,
          db: n8n.postgresConfig,
      }
    : undefined;
