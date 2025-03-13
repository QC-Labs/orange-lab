import * as kubernetes from '@pulumi/kubernetes';
import { PersistentStorageType } from './persistent-storage';

export interface LocalVolume {
    name: string;
    hostPath: string;
}

export class Volumes {
    private readonly volumes = new Map<string, kubernetes.types.input.core.v1.Volume>();

    create(): kubernetes.types.input.core.v1.Volume[] {
        return Array.from(this.volumes.values());
    }

    addLocalVolume(volume: LocalVolume) {
        this.volumes.set(volume.name, {
            name: volume.name,
            hostPath: { path: volume.hostPath },
        });
    }

    hasLocal(): boolean {
        return this.volumes.size > 0;
    }
}
