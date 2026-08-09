import { config } from '@orangelab/pulumi';

export interface MediaStorage {
    fromVolume?: string;
    hostPath?: string;
    storageSize?: string;
}

export function getMediaStorage(appName: string): MediaStorage {
    const directFromVolume = config.get(appName, 'media/fromVolume');
    const directHostPath = config.get(appName, 'media/hostPath');
    const directStorageSize = config.get(appName, 'media/storageSize');
    const profile = config.get(appName, 'media');
    const profileFromVolume = profile ? config.get(profile, 'fromVolume') : undefined;
    const profileHostPath = profile ? config.get(profile, 'hostPath') : undefined;
    const profileStorageSize = profile ? config.get(profile, 'storageSize') : undefined;
    const fromVolume = directFromVolume ?? (directHostPath ? undefined : profileFromVolume);
    const hostPath = directFromVolume ? undefined : directHostPath ?? profileHostPath;
    const storageSize = directStorageSize ?? profileStorageSize;

    if (fromVolume && !storageSize) {
        throw new Error(
            `${appName}: ${profile ? `${profile}:storageSize` : `${appName}:media/storageSize`} must be set when using fromVolume`,
        );
    }
    if (!fromVolume && !hostPath) {
        throw new Error(
            profile
                ? `${appName}: profile ${profile} must define fromVolume or hostPath`
                : `${appName}:media, ${appName}:media/fromVolume, or ${appName}:media/hostPath must be set`,
        );
    }

    return { fromVolume, hostPath, storageSize };
}
