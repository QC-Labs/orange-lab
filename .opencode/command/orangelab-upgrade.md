---
description: Upgrade OrangeLab to latest version
---

Guided upgrade process for OrangeLab. Fetches breaking changes from GitHub releases and walks through migration steps interactively.

## Context

- **Current version**: Read from `package.json` (version field)
- **GitHub releases**: https://github.com/QC-Labs/orange-lab/releases
- **Repository**: QC-Labs/orange-lab
- **Upgrade docs**: `docs/upgrade.md` - standard upgrade procedures
- **Storage docs**: `docs/configuration.md` - volume management and `fromVolume` usage

## Overview

This command helps users upgrade their OrangeLab installation safely by:

1. Checking current version and fetching breaking changes from GitHub releases
2. Ensuring storage safety with static volumes (`fromVolume` configuration)
3. Updating K3s nodes if needed
4. Disabling affected apps, pulling changes, and redeploying
5. Validating the upgrade was successful

## Important Rules

- Before each step: Explain what will be done so the user understands the process
- After each step: Summarize what happened and confirm everything is on track
- Ask for confirmation before proceeding to the next step
- If issues occur: Summarize them, suggest potential resolutions, and ask for direction
- Never proceed automatically if errors are detected

## Steps

### Step 1: Analyze Current State

**Explain**: "I'll check your current OrangeLab version and fetch the latest release information to identify breaking changes that affect your upgrade."

**Actions**:

- Read `package.json` to get current version
- Run `git fetch origin` to get latest remote state
- Run `git log HEAD..origin/main --oneline` to see incoming changes
- Fetch GitHub releases using: `gh release list --repo QC-Labs/orange-lab --limit 10`
- For each release newer than current version, fetch release notes: `gh release view <tag> --repo QC-Labs/orange-lab`
- Look for "BREAKING CHANGES" or "UPGRADE ACTIONS" sections in release notes

**Summary**: Report current version, target version, and list all breaking changes that apply. Ask for confirmation to proceed.

### Step 2: Verify Storage Safety (Static Volumes)

**Explain**: "Before making any changes, I'll verify your storage configuration. Apps using static volumes (`fromVolume`) can be safely disabled and re-enabled without losing data - the Longhorn volume just gets detached and can be reattached. Apps using dynamic volumes will lose their storage if disabled."

**Actions**:

- Read Pulumi stack config: `pulumi config`
- For each enabled app, check if `<app>:fromVolume` is configured
- List apps that have persistent storage but no `fromVolume` set
- Cross-reference with apps that have breaking changes

**Expected output**:

```
Storage Safety Check:
  ollama: fromVolume=ollama (static, safe to disable)
  nextcloud: fromVolume=nextcloud (static, safe to disable)
  bitcoin: WARNING - using dynamic volume, will lose data if disabled
```

**Summary**: If any apps are missing `fromVolume` and have breaking changes:

1. Explain the risk: "This app uses a dynamic volume. If we disable it, the PersistentVolume and its data will be deleted."
2. Recommend converting to static volume before proceeding:

    ```bash
    # Set storageOnly to keep volume while disabling app resources
    pulumi config set <app>:storageOnly true
    pulumi up

    # Then clone volume in Longhorn UI with descriptive name (e.g., app name)
    # Finally, attach the static volume:
    pulumi config set <app>:fromVolume <volume-name>
    pulumi config delete <app>:storageOnly
    ```

3. Ask user to confirm they've set up static volumes or accepted the risk before proceeding

### Step 3: Extract and Save Secrets

**Explain**: "Before disabling apps, I need to save encryption keys and database passwords to your Pulumi config. These are available from Pulumi stack outputs. This ensures the same credentials are used when re-enabling apps, which is critical for accessing encrypted data and databases restored from backups."

**Actions**:

- For apps with breaking changes, check if they have:
    - Encryption keys (e.g., n8n has `encryptionKey`)
    - Database passwords (PostgreSQL or MariaDB)
- Get current values from Pulumi outputs and save to config

**Get secrets from Pulumi outputs**:

```bash
# View all outputs with secrets
pulumi stack output --show-secrets --json

# Get specific module outputs
pulumi stack output ai --show-secrets --json
pulumi stack output bitcoin --show-secrets --json
pulumi stack output office --show-secrets --json
```

**For apps with encryption keys** (e.g., n8n):

```bash
# Get n8n encryption key from output
pulumi stack output ai --show-secrets --json | jq -r '.n8n.encryptionKey'

# Save to Pulumi config
pulumi config set n8n:N8N_ENCRYPTION_KEY "<key>" --secret
```

**For apps with PostgreSQL databases** (CloudNative-PG):

```bash
# Get database password from output (e.g., n8n, open-webui)
pulumi stack output ai --show-secrets --json | jq -r '.n8n.db.password'

# Save to Pulumi config
pulumi config set <app>:db/password "<password>" --secret
```

**For apps with MariaDB databases** (e.g., nextcloud, mempool):

```bash
# Get database password from output
pulumi stack output office --show-secrets --json | jq -r '.nextcloud.db.password'
pulumi stack output bitcoin --show-secrets --json | jq -r '.mempool.db.password'

# Save to Pulumi config
pulumi config set <app>:db/rootPassword "<password>" --secret
```

**Expected output**:

```
Secrets Check:
  n8n:
    - N8N_ENCRYPTION_KEY: saved to config
    - db/password: saved to config
  nextcloud:
    - db/rootPassword: saved to config
  open-webui:
    - db/password: already in config
```

**Summary**: List all secrets that were extracted and saved. Warn if any secrets could not be retrieved (app might not be deployed yet). Ask for confirmation before proceeding.

**Why this matters**:

- **Encryption keys**: Without the original key, encrypted data (like n8n workflow credentials) cannot be decrypted
- **Database passwords**: When restoring from backup, the password in the database must match what the app uses. Setting it in config ensures consistency

**If secrets are not in outputs** (app was never deployed or outputs are missing):

- For fresh installs, secrets will be auto-generated on first deploy
- For recovery from backup, you may need to reset database passwords - see `components/data/mariadb-operator/mariadb-operator.md` for MariaDB reset procedure

### Step 4: Update K3s Nodes

**Explain**: "It's recommended to update K3s on your all cluster nodes. This also ensures any configuration changes are applied."

**Actions**:

- Generate server update script: `./scripts/k3s-server.sh`
- Generate agent update script: `./scripts/k3s-agent.sh`
- Display the scripts and explain what they do
- Instruct user to run these on their nodes manually

**Expected instructions**:

```sh
K3s agent update required. Run this on each agent node:
  1. SSH to agent: ssh root@<agent-node>
  2. Execute the generated script (shown above)
  3. Verify: systemctl status k3s-agent.service and check node status with `kubectl get nodes -o wide`

K3s server update required. Run this on your server node:
  1. SSH to server: ssh root@<server-node>
  2. Execute the generated script (shown above)
  3. Verify: `systemctl status k3s.service` and check node status with `kubectl get nodes -o wide`
```

**Check node labels** (required for some components):

```bash
# View current node labels
kubectl get nodes --show-labels

# Longhorn storage nodes need this label (at least one node required)
kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true

# Zone labels for location-aware scheduling (e.g., home-assistant)
kubectl label nodes <node-name> topology.kubernetes.io/zone=home
```

> Note: GPU nodes are automatically detected and labeled by Node Feature Discovery (NFD).

**Summary**: Wait for user to confirm nodes are updated before proceeding.

### Step 5: Disable Apps with Breaking Changes

**Explain**: "I'll disable apps that have breaking changes. Since we verified static volumes are configured, the Longhorn volumes will just be detached (not deleted) and can be reattached after the upgrade."

**Actions**:

- Identify apps from breaking changes that need to be disabled
- For each app:
    ```bash
    pulumi config set <app>:enabled false
    ```
- Run `pulumi preview --diff` to show what will be removed
- Verify that PersistentVolumes show as being removed but explain this is expected - the underlying Longhorn volume persists
- Confirm with user before running `pulumi up --yes`

**Summary**: List apps that were disabled. Confirm:

- Application resources (Deployment, Service, Ingress) were removed
- PersistentVolume/PersistentVolumeClaim were removed (but Longhorn volume persists, they should show up in Longhorn UI as "Detached")
- No unexpected deletions occurred

### Step 6: Pull Latest Changes

**Explain**: "I'll now pull the latest code changes using git rebase to keep your history clean."

**Actions**:

- Check for uncommitted changes: `git status`
- If there are uncommitted changes, ask user how to proceed (stash, commit, or abort)
- Run `git pull --rebase origin main`
- Run `npm install` to update dependencies
- Run `npm test` to verify code compiles

**Summary**: Report if pull was successful and if there were any merge conflicts to resolve.

### Step 7: Preview Infrastructure Changes

**Explain**: "I'll run a Pulumi preview to check for any unexpected infrastructure changes before applying."

**Actions**:

- Run `pulumi preview --diff`
- Analyze the output for:
    - Expected changes (from breaking changes we know about)
    - Unexpected changes (investigate and explain)
    - Potential issues (resource replacements, deletions)

**Summary**: Present the preview results:

- If only expected changes: "Preview shows expected changes based on the breaking changes we identified."
- If unexpected changes: "Found unexpected changes that need investigation:" (list them)
- Ask for confirmation before applying

### Step 8: Apply Infrastructure Changes

**Explain**: "I'll now apply the infrastructure changes to upgrade your cluster."

**Actions**:

- Run `pulumi up --yes`
- Monitor for errors during deployment
- If errors occur:
    - Summarize the error
    - Suggest potential resolutions based on common issues:
        - Resource conflicts: Try disabling and re-enabling the app
        - Permission issues: Check node labels and taints
        - Storage issues: Verify volumes exist and `fromVolume` is correct
        - Network issues: Check Tailscale connectivity
    - Ask user for direction before proceeding

**Summary**: Report deployment status and any issues that occurred.

### Step 9: Re-enable Previously Disabled Apps

**Explain**: "I'll re-enable the apps that were disabled for the upgrade."

**Actions**:

- For each app that was disabled in Step 5:
    ```bash
    pulumi config set <app>:enabled true
    ```
- Run `pulumi preview --diff` to show what will be created

**Summary**: Show preview of apps being re-enabled and ask for confirmation.

### Step 10: Deploy Re-enabled Apps

**Explain**: "I'll deploy the re-enabled apps with their new configuration."

**Actions**:

- Run `pulumi up --yes`
- Monitor for errors
- If errors occur, provide troubleshooting guidance and ask for direction

**Summary**: Report deployment status for each re-enabled app.

### Step 11: Validate Upgrade

**Explain**: "I'll verify that your services are running correctly by checking ingress endpoints and pod health."

**Actions**:

- Check if custom domain is configured: `pulumi config get customDomain 2>/dev/null`
- Get list of deployed apps from Pulumi outputs: `pulumi stack output --json`
- For apps with endpoints, test connectivity:
    ```bash
    # For each endpoint URL
    curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 <url>
    ```
- Check pod status: `kubectl get pods -A | grep -v Running | grep -v Completed`
- Check for any crashlooping pods: `kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded`

**Ingress controller check** (depends on configuration):

```bash
# If customDomain is set - check Traefik
kubectl get pods -n traefik
kubectl get ingressroutes -A

# For all setups - check Tailscale operator (used for TCP routes even with custom domain)
kubectl get pods -n tailscale
kubectl get svc -n tailscale
```

**Expected output** (with custom domain):

```
Endpoint Health Check:
  https://ollama.example.com: 200 OK
  https://nextcloud.example.com: 200 OK
  https://grafana.example.com: 302 (redirect, OK)

Ingress Status:
  Traefik: Running (custom domain routing)
  Tailscale: Running (TCP routes, direct access)

Pod Status:
  All pods running normally

Upgrade Status: SUCCESS
```

**Expected output** (Tailscale only):

```
Endpoint Health Check:
  https://ollama.tail12345.ts.net: 200 OK
  https://nextcloud.tail12345.ts.net: 200 OK
  https://grafana.tail12345.ts.net: 302 (redirect, OK)

Ingress Status:
  Tailscale: Running

Pod Status:
  All pods running normally

Upgrade Status: SUCCESS
```

**Summary**: Final upgrade report:

- Version upgraded: X.X.X -> Y.Y.Y
- Apps upgraded: [list]
- Endpoints verified: [list]
- Ingress mode: Traefik (custom domain) / Tailscale only
- Any remaining issues or manual steps needed

## Troubleshooting

If issues occur at any step, provide context-aware guidance:

### Common Issues

1. **Volume not found**: Ensure `fromVolume` matches an existing Longhorn volume name in Longhorn UI
2. **Database connection failed**: Check if database operator pods are running
3. **Database password mismatch**: Password in config doesn't match what's stored in the restored database
    - This happens if you forgot to save the password before disabling the app
    - For MariaDB, see reset procedure in `components/data/mariadb-operator/mariadb-operator.md`
    - For PostgreSQL, use `pg-restore.sh` script to restore from dump, or reset password manually
4. **Encryption key mismatch**: App cannot decrypt data because key changed
    - This happens if you forgot to save the encryption key before disabling the app
    - If app is still running, extract from Pulumi output: `pulumi stack output ai --show-secrets --json | jq -r '.n8n.encryptionKey'`
    - If app was already removed, data encrypted with old key is unrecoverable
5. **Ingress not responding**:
    - With custom domain: Check Traefik pods `kubectl get pods -n traefik` and cert-manager `kubectl get certificates -A`
    - Tailscale routes: Check operator `kubectl get pods -n tailscale` and services `kubectl get svc -n tailscale`
6. **Pod crashlooping**: Check logs with `kubectl logs -n <namespace> <pod>`
7. **Pulumi state conflict**: May need `pulumi refresh` to sync state
8. **App stuck deploying**: Try `storageOnly` mode to keep storage while removing app resources:

    ```bash
    pulumi config set <app>:enabled true
    pulumi config set <app>:storageOnly true
    pulumi up

    pulumi config delete <app>:storageOnly
    pulumi up
    ```

### Recovery Options

- **Rollback code**: `git checkout <previous-commit>`
- **Rollback infrastructure**: Pulumi maintains state history, but app data may be affected
- **Skip problematic app**: Disable app and continue with rest of upgrade
- **Restore from backup**: Use Longhorn UI to restore volume from backup, then set `fromVolume`

## Expected Output Format

For each step, use this format:

```
## Step N: <Step Name>

### What we're doing
<Explanation of the step>

### Actions taken
<Commands run and their output>

### Result
<Summary of what happened>

### Next steps
<What will happen next, or ask for confirmation>
```
