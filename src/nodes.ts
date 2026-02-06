import * as kubernetes from '@pulumi/kubernetes';
import { config } from './config';

type NodeSelectorTerm = kubernetes.types.input.core.v1.NodeSelectorTerm;

export interface NodesArgs {
    appName: string;
    gpu?: boolean;
}

export class Nodes {
    /**
     * Optional GPU type, if specified, will set node affinity for the specified GPU type.
     * If `gpu` is true, it will default to 'nvidia' unless 'amd-gpu' config is set to true.
     */
    public readonly gpu?: 'nvidia' | 'amd';

    constructor(private args: NodesArgs) {
        if (args.gpu) {
            const useAmdGpu = config.getBoolean(args.appName, 'amd-gpu') ?? false;
            this.gpu = useAmdGpu ? 'amd' : 'nvidia';
        }
    }

    getAffinity(component?: string): kubernetes.types.input.core.v1.Affinity | undefined {
        const prefix = component ? `${component}/` : '';
        const preferredNodeLabel =
            config.get(this.args.appName, `${prefix}preferredNodeLabel`) ??
            config.get(this.args.appName, 'preferredNodeLabel');
        const requiredNodeLabel =
            config.get(this.args.appName, `${prefix}requiredNodeLabel`) ??
            config.get(this.args.appName, 'requiredNodeLabel');
        const requiredTerms = this.getRequiredNodeSelectorTerms(requiredNodeLabel);

        if (requiredTerms.length === 0 && !preferredNodeLabel) return;

        return {
            nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution:
                    requiredTerms.length > 0
                        ? { nodeSelectorTerms: requiredTerms }
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

    getVolumeAffinity(): kubernetes.types.input.core.v1.VolumeNodeAffinity | undefined {
        return this.args.gpu
            ? {
                  required: {
                      nodeSelectorTerms: [
                          this.getNodeSelectorTerm('node-role.kubernetes.io/gpu=true'),
                      ],
                  },
              }
            : undefined;
    }

    getLocalVolumeAffinity(): kubernetes.types.input.core.v1.VolumeNodeAffinity {
        const requiredNodeLabel = config.require(this.args.appName, 'requiredNodeLabel');
        return {
            required: {
                nodeSelectorTerms: [this.getNodeSelectorTerm(requiredNodeLabel)],
            },
        };
    }

    private getRequiredNodeSelectorTerms(requiredNodeLabel?: string): NodeSelectorTerm[] {
        const terms: NodeSelectorTerm[] = [];

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
     * - "topology.kubernetes.io/zone: zone1|zone2" - matches nodes with label set to either "zone1" or "zone2"
     * - "orangelab/gpu-nvidia" - matches nodes that have the label (any value)
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
