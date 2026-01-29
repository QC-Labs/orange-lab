---
description: Upgrade OrangeLab to latest version
---

Guided upgrade process for OrangeLab. Fetches breaking changes from GitHub releases and walks through migration steps interactively.

## Mode of Operation

**You are operating in PLAN MODE as a guide.** You will:

- **ANALYZE** the current state using read-only commands (`pulumi config`, `pulumi preview`, `git status`, etc.)
- **EXPLAIN** each step clearly so the user understands what needs to be done
- **SHOW** the exact commands the user should run in their terminal
- **VERIFY** the user completed each step correctly before proceeding

**You must NEVER:**

- Execute commands that modify state (`pulumi up`, `pulumi config set`, `git pull`, etc.)
- Use `--show-secrets` flag - secrets must not be sent to external models
- Make any changes to files or infrastructure directly

**When showing commands for the user to run**, format them clearly:

```
👉 Run this command in your terminal:
   <command>
```

## Context

- **Current version**: Read from `package.json` (version field)
- **GitHub releases**: https://github.com/QC-Labs/orange-lab/releases
- **Repository**: QC-Labs/orange-lab
- **Upgrade docs**: `docs/upgrade.md` - standard upgrade procedures
- **Storage docs**: `docs/configuration.md` - volume management and `fromVolume` usage

## Overview

This command guides users through upgrading their OrangeLab installation safely by:

1. Checking current version and fetching breaking changes from GitHub releases
2. Ensuring storage safety with static volumes (`fromVolume` configuration)
3. Updating K3s nodes if needed
4. Disabling affected apps, pulling changes, and redeploying
5. Validating the upgrade was successful

## Important Rules

- Before each step: Explain what will be done so the user understands the process
- After each step: Ask the user to share the output, then verify everything is correct
- Ask for confirmation before proceeding to the next step
- If issues occur: Summarize them, suggest potential resolutions, and ask for direction
- Never proceed automatically if errors are detected
- **NEVER use `--show-secrets`** - this would expose secrets to external models

## Steps

### Step 1: Analyze Current State

**Explain**: "I'll check your current OrangeLab version and fetch the latest release information to identify breaking changes that affect your upgrade."

**You (LLM) should run these read-only commands**:

- Read `package.json` to get current version
- Run `git fetch origin` to get latest remote state
- Run `git log HEAD..origin/main --oneline` to see incoming changes
- Fetch GitHub releases using: `gh release list --repo QC-Labs/orange-lab --limit 10`
- For each release newer than current version, fetch release notes: `gh release view <tag> --repo QC-Labs/orange-lab`
- Look for "BREAKING CHANGES" or "UPGRADE ACTIONS" sections in release notes

**Summary**: Report current version, target version, and list all breaking changes that apply. Ask for confirmation to proceed.

### Step 2: Verify Storage Safety (Static Volumes)

**Explain**: "Before making any changes, I'll verify your storage configuration. Apps using static volumes (`fromVolume`) can be safely disabled and re-enabled without losing data - the Longhorn volume just gets detached and can be reattached. Apps using dynamic volumes will lose their storage if disabled."

**You (LLM) should run these read-only commands**:

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
2. Show the user commands to convert to static volume:

    ```
    👉 Run these commands in your terminal to convert to static volume:

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

**Explain**: "Before disabling apps, you need to save encryption keys and database passwords to your Pulumi config. This ensures the same credentials are used when re-enabling apps, which is critical for accessing encrypted data and databases restored from backups."

**IMPORTANT: You (LLM) must NOT run any `--show-secrets` commands.** The user must handle secrets directly in their terminal.

**Tell the user which apps need secrets saved** based on breaking changes identified in Step 1:

- Apps with encryption keys (e.g., n8n has `encryptionKey`)
- Apps with database passwords (PostgreSQL or MariaDB)

**Show the user commands to extract and save secrets**:

```
👉 Run these commands in your terminal to extract and save secrets:

   # For apps with encryption keys (e.g., n8n):
   pulumi stack output ai --show-secrets --json | jq -r '.n8n.encryptionKey'
   # Then save it:
   pulumi config set n8n:N8N_ENCRYPTION_KEY "<key-from-above>" --secret

   # For apps with PostgreSQL databases (e.g., n8n, open-webui):
   pulumi stack output ai --show-secrets --json | jq -r '.n8n.db.password'
   # Then save it:
   pulumi config set <app>:db/password "<password-from-above>" --secret

   # For apps with MariaDB databases (e.g., nextcloud, mempool):
   pulumi stack output office --show-secrets --json | jq -r '.nextcloud.db.password'
   # Then save it:
   pulumi config set <app>:db/rootPassword "<password-from-above>" --secret
```

**After user completes**, verify by running (read-only, no secrets shown):

```bash
pulumi config
```

Check that the required secret keys are present (values will show as `[secret]`).

**Expected verification output**:

```
Secrets Check:
  n8n:N8N_ENCRYPTION_KEY: [secret] present
  n8n:db/password: [secret] present
  nextcloud:db/rootPassword: [secret] present
```

**Summary**: Confirm all required secrets are saved in config. Ask user to confirm before proceeding.

**Why this matters**:

- **Encryption keys**: Without the original key, encrypted data (like n8n workflow credentials) cannot be decrypted
- **Database passwords**: When restoring from backup, the password in the database must match what the app uses. Setting it in config ensures consistency

**If secrets are not in outputs** (app was never deployed or outputs are missing):

- For fresh installs, secrets will be auto-generated on first deploy
- For recovery from backup, you may need to reset database passwords - see `components/data/mariadb-operator/mariadb-operator.md` for MariaDB reset procedure

### Step 4: Update K3s Nodes

**Explain**: "It's recommended to update K3s on all your cluster nodes. This also ensures any configuration changes are applied."

**You (LLM) should run these read-only commands** to generate the scripts:

- Generate server update script: `./scripts/k3s-server.sh`
- Generate agent update script: `./scripts/k3s-agent.sh`

**Then show the user what to do**:

```
👉 Run these steps on your nodes:

   K3s agent update (run on each agent node):
     1. SSH to agent: ssh root@<agent-node>
     2. Execute the generated script (shown above)
     3. Verify: systemctl status k3s-agent.service

   K3s server update (run on your server node):
     1. SSH to server: ssh root@<server-node>
     2. Execute the generated script (shown above)
     3. Verify: systemctl status k3s.service
```

**You (LLM) can verify node status** by running:

```bash
kubectl get nodes -o wide
```

**Check node labels** (you can run this read-only command):

```bash
kubectl get nodes --show-labels
```

**If node labels need updating**, show the user:

```
👉 Run these commands in your terminal to set node labels:

   # Longhorn storage nodes need this label (at least one node required)
   kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true

   # Zone labels for location-aware scheduling (e.g., home-assistant)
   kubectl label nodes <node-name> topology.kubernetes.io/zone=home
```

> Note: GPU nodes are automatically detected and labeled by Node Feature Discovery (NFD).

**Summary**: Verify nodes are updated and healthy before proceeding. Ask user to confirm.

### Step 5: Disable Apps with Breaking Changes

**Explain**: "We need to disable apps that have breaking changes. Since we verified static volumes are configured, the Longhorn volumes will just be detached (not deleted) and can be reattached after the upgrade."

**Show the user the commands to disable apps**:

```
👉 Run these commands in your terminal to disable apps with breaking changes:

   pulumi config set <app>:enabled false
   # Repeat for each app that needs to be disabled
```

**After user disables apps, you (LLM) can preview** by running:

```bash
pulumi preview --diff
```

**Explain to the user**: PersistentVolumes showing as being removed is expected - the underlying Longhorn volume persists and will show as "Detached" in the Longhorn UI.

**Then show the user the apply command**:

```
👉 Review the preview above. If it looks correct, run:

   pulumi up --yes
```

**After user applies**, verify by asking them to share the output.

**Summary**: Confirm with user:

- Application resources (Deployment, Service, Ingress) were removed
- PersistentVolume/PersistentVolumeClaim were removed (but Longhorn volume persists, they should show up in Longhorn UI as "Detached")
- No unexpected deletions occurred

### Step 6: Pull Latest Changes

**Explain**: "Now we need to pull the latest code changes using git rebase to keep your history clean."

**You (LLM) can check for uncommitted changes** by running:

```bash
git status
```

**If there are uncommitted changes**, ask user how to proceed (stash, commit, or abort).

**Show the user commands to pull and update**:

```
👉 Run these commands in your terminal:

   git pull --rebase origin main
   npm install
   npm test
```

**After user completes**, you (LLM) can verify by running:

```bash
git log --oneline -5
npm test
```

**Summary**: Verify pull was successful and tests pass. If there were merge conflicts, help user resolve them.

### Step 7: Preview Infrastructure Changes

**Explain**: "I'll run a Pulumi preview to check for any unexpected infrastructure changes before applying."

**You (LLM) should run this read-only command**:

```bash
pulumi preview --diff
```

**Analyze the output for**:

- Expected changes (from breaking changes we know about)
- Unexpected changes (investigate and explain)
- Potential issues (resource replacements, deletions)

**Summary**: Present the preview results to the user:

- If only expected changes: "Preview shows expected changes based on the breaking changes we identified."
- If unexpected changes: "Found unexpected changes that need investigation:" (list them)
- Ask for confirmation before user applies

### Step 8: Apply Infrastructure Changes

**Explain**: "Now we'll apply the infrastructure changes to upgrade your cluster."

**Show the user the apply command**:

```
👉 Run this command in your terminal:

   pulumi up --yes
```

**After user applies**, ask them to share the output so you can verify.

**If errors occur**, provide troubleshooting guidance:

- Resource conflicts: Try disabling and re-enabling the app
- Permission issues: Check node labels and taints
- Storage issues: Verify volumes exist and `fromVolume` is correct
- Network issues: Check Tailscale connectivity

**Summary**: Verify deployment was successful based on user's output.

### Step 9: Re-enable Previously Disabled Apps

**Explain**: "Now we'll re-enable the apps that were disabled for the upgrade."

**Show the user commands to re-enable apps**:

```
👉 Run these commands in your terminal to re-enable apps:

   pulumi config set <app>:enabled true
   # Repeat for each app that was disabled in Step 5
```

**After user re-enables apps, you (LLM) can preview** by running:

```bash
pulumi preview --diff
```

**Summary**: Show preview of apps being re-enabled and ask for confirmation before user applies.

### Step 10: Deploy Re-enabled Apps

**Explain**: "Now we'll deploy the re-enabled apps with their new configuration."

**Show the user the apply command**:

```
👉 Run this command in your terminal:

   pulumi up --yes
```

**After user applies**, ask them to share the output so you can verify.

**If errors occur**, provide troubleshooting guidance and ask user for direction.

**Summary**: Verify deployment status for each re-enabled app based on user's output.

### Step 11: Validate Upgrade

**Explain**: "I'll verify that your services are running correctly by checking ingress endpoints and pod health."

**You (LLM) should run these read-only commands**:

```bash
# Check if custom domain is configured
pulumi config get customDomain 2>/dev/null

# Get list of deployed apps (no secrets)
pulumi stack output --json

# Check pod status
kubectl get pods -A | grep -v Running | grep -v Completed

# Check for crashlooping pods
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded
```

**For endpoint health checks**, show the user:

```
👉 You can test your endpoints with:

   curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 <url>
```

**Ingress controller check** - you (LLM) can run these read-only commands:

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
    - If app is still running, user can extract from Pulumi output in their terminal: `pulumi stack output ai --show-secrets --json | jq -r '.n8n.encryptionKey'`
    - If app was already removed, data encrypted with old key is unrecoverable
5. **Ingress not responding**:
    - With custom domain: Check Traefik pods `kubectl get pods -n traefik` and cert-manager `kubectl get certificates -A`
    - Tailscale routes: Check operator `kubectl get pods -n tailscale` and services `kubectl get svc -n tailscale`
6. **Pod crashlooping**: Check logs with `kubectl logs -n <namespace> <pod>`
7. **Pulumi state conflict**: May need `pulumi refresh` to sync state
8. **App stuck deploying**: Guide user to try `storageOnly` mode to keep storage while removing app resources:

    ```
    👉 Run these commands in your terminal:

       pulumi config set <app>:enabled true
       pulumi config set <app>:storageOnly true
       pulumi up

       pulumi config delete <app>:storageOnly
       pulumi up
    ```

### Recovery Options

Guide user with these commands if needed:

- **Rollback code**: `git checkout <previous-commit>`
- **Rollback infrastructure**: Pulumi maintains state history, but app data may be affected
- **Skip problematic app**: `pulumi config set <app>:enabled false` and continue with rest of upgrade
- **Restore from backup**: Use Longhorn UI to restore volume from backup, then `pulumi config set <app>:fromVolume <volume-name>`

## Expected Output Format

For each step, use this format:

```
## Step N: <Step Name>

### What we're doing
<Explanation of the step>

### Analysis (read-only commands I ran)
<Commands you ran and their output>

### Commands for you to run
<Show commands the user needs to execute in their terminal>

### Verification
<After user runs commands, verify the results>

### Next steps
<What will happen next, or ask for confirmation>
```

## Summary of Read-Only vs User Commands

**You (LLM) can safely run**:

- `pulumi config` (without `--show-secrets`)
- `pulumi preview --diff`
- `pulumi stack output --json` (without `--show-secrets`)
- `git status`, `git log`, `git fetch`, `git diff`
- `kubectl get ...` (any read operations)
- `gh release list`, `gh release view`
- `npm test`

**User must run in their terminal**:

- `pulumi up`, `pulumi up --yes`
- `pulumi config set ...`
- `pulumi config delete ...`
- `git pull`, `git checkout`, `git stash`
- `npm install`
- `kubectl label ...`
- Any command with `--show-secrets`
- SSH commands to nodes
