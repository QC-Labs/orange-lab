import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

type NodeSelectorTerm = kubernetes.types.input.core.v1.NodeSelectorTerm;

export interface NodesArgs {
    config: pulumi.Config;
    gpu?: boolean;
}

export class Nodes {
    /**
     * Optional GPU type, if specified, will set node affinity for the specified GPU type.
     * If `gpu` is true, it will default to 'nvidia' unless 'amd-gpu' config is set to true.
     */
    public readonly gpu?: 'nvidia' | 'amd';

    constructor(private readonly args: NodesArgs) {
        if (args.gpu) {
            const useAmdGpu = args.config.getBoolean('amd-gpu') ?? false;
            this.gpu = useAmdGpu ? 'amd' : 'nvidia';
        }
    }

    getAffinity(): kubernetes.types.input.core.v1.Affinity | undefined {
        const requiredTerms = this.getRequiredNodeSelectorTerms();
        const preferredLabel = this.args.config.get('preferredNodeLabel');

        if (requiredTerms.length === 0 && !preferredLabel) return;

        return {
            nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution:
                    requiredTerms.length > 0
                        ? { nodeSelectorTerms: requiredTerms }
                        : undefined,
                preferredDuringSchedulingIgnoredDuringExecution: preferredLabel
                    ? [
                          {
                              preference: this.getNodeSelectorTerm(preferredLabel),
                              weight: 1,
                          },
                      ]
                    : undefined,
            },
        };
    }

    getVolumeAffinity(): kubernetes.types.input.core.v1.VolumeNodeAffinity | undefined {
        const terms: NodeSelectorTerm[] = [];
        const requiredNodeLabel = this.args.config.get('requiredNodeLabel');
        if (requiredNodeLabel) {
            terms.push(this.getNodeSelectorTerm(requiredNodeLabel));
        }
        if (this.args.gpu) {
            terms.push(this.getNodeSelectorTerm('orangelab/gpu=true'));
        }
        return terms.length
            ? {
                  required: {
                      nodeSelectorTerms: terms,
                  },
              }
            : undefined;
    }

    private getRequiredNodeSelectorTerms(): NodeSelectorTerm[] {
        const terms: NodeSelectorTerm[] = [];
        const requiredNodeLabel = this.args.config.get('requiredNodeLabel');

        if (requiredNodeLabel) {
            terms.push(this.getNodeSelectorTerm(requiredNodeLabel));
        }

        if (this.gpu === 'amd') {
            terms.push(this.getNodeSelectorTerm('orangelab/gpu-amd=true'));
        }
        if (this.gpu === 'nvidia') {
            terms.push(this.getNodeSelectorTerm('orangelab/gpu-nvidia=true'));
        }
        return terms;
    }

    /**
     * Creates a NodeSelectorTerm from a label specification string.
     *
     * Format: key=value1|value2|value3
     *
     * Examples:
     * - "orangelab/gpu=true|nvidia" - matches nodes with label orangelab/gpu set to either "true" or "nvidia"
     * - "orangelab/gpu" - matches nodes that have the orangelab/gpu label (any value)
     *
     * @param labelSpec - Label specification in format "key", "key=value" or "key=value1|value2"
     * @returns NodeSelectorTerm with appropriate matchExpressions
     */
    private getNodeSelectorTerm(labelSpec: string): NodeSelectorTerm {
        const [key, value] = labelSpec.split('=');
        if (!value) {
            return { matchExpressions: [{ key, operator: 'Exists' }] };
        }
        return {
            matchExpressions: [
                {
                    key,
                    operator: 'In',
                    values: value.split('|'),
                },
            ],
        };
    }
}
