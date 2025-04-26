// dagger-secrets.ts
import { Secret } from '@dagger.io/dagger';

export function getPulumiSecrets(client: Client) {
  return {
    pulumiAccessToken: client.setSecret(
      'pulumiAccessToken',
      process.env.PULUMI_ACCESS_TOKEN || ''
    )
  };
}
