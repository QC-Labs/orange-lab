import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export class Nodes {
    private config: pulumi.Config;

    constructor(config: pulumi.Config) {
        this.config = config;
    }

    getAffinity(): kubernetes.types.input.core.v1.Affinity | undefined {
        const requiredNodeLabel = this.config.get('requiredNodeLabel');
        const preferredNodeLabel = this.config.get('preferredNodeLabel');
        if (!requiredNodeLabel && !preferredNodeLabel) return;

        return {
            nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: requiredNodeLabel
                    ? {
                          nodeSelectorTerms: [
                              this.getNodeSelectorTerm(requiredNodeLabel),
                          ],
                      }
                    : undefined,
                preferredDuringSchedulingIgnoredDuringExecution: preferredNodeLabel
                    ? [
                          {
                              preference: this.getNodeSelectorTerm(preferredNodeLabel),
                              weight: 1,
                          },
                      ]
                    : undefined,
            },
        };
    }

    private getNodeSelectorTerm(labelSpec: string) {
        const [key, value] = labelSpec.split('=');
        const match = value
            ? { key, operator: 'In', values: [value] }
            : { key, operator: 'Exists' };
        return { matchExpressions: [match] };
    }
}
