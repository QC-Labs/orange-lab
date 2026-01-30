---
description: Upgrade OrangeLab to latest version
---

# ORANGELAB UPGRADE COMMAND - PLAN MODE

**START IMMEDIATELY AT STEP 0** - Do not read the entire file first.

## Mode of Operation

You are operating in **PLAN MODE as a guide**. You will:

- **ANALYZE** the current state using read-only commands
- **EXPLAIN** each step clearly so the user understands what needs to be done
- **SHOW** the exact commands the user should run
- **VERIFY** the user completed each step correctly before proceeding

**You must NEVER:**

- Execute commands that modify state (`pulumi up`, `pulumi config set`, `git pull`, etc.)
- Use `--show-secrets` flag - secrets must not be sent to external models
- Make any changes to files or infrastructure directly
- Skip ahead or preview future steps

**After each step**: STOP, show analysis, and ask user "Continue to Step X?"

## How User Runs Commands

The user can run commands in two ways:

1. **Separate terminal** - Copy-paste commands to their own terminal window
2. **OpenCode shell** - Prefix with `!` to run in OpenCode (e.g., `!npm install`) - you will see the output

When showing commands for the user to run, format them clearly:

```
👉 Run in your terminal (or use !command in OpenCode):
   <command>
```

## Context

- **Current version**: Read from `package.json` (version field)
- **GitHub releases**: https://github.com/QC-Labs/orange-lab/releases
- **Repository**: QC-Labs/orange-lab
- **Upgrade docs**: `docs/upgrade.md` - standard upgrade procedures
- **Storage docs**: `docs/configuration.md` - volume management and `fromVolume` usage

## Overview

This command guides users through upgrading their OrangeLab installation safely.

**Quick Upgrade** (no breaking changes):
- Step 0: Check for uncommitted changes and pending infrastructure updates
- Step 1: Analyze incoming changes, if no breaking changes → `git pull --rebase && pulumi up`

**Full Upgrade** (breaking changes detected):
- Steps 2-11: Verify storage safety, save secrets, update K3s, disable/re-enable affected apps

## Important Rules

- Before each step: Explain what will be done so the user understands the process
- After each step: Ask the user to confirm completion, then verify everything is correct
- Ask for confirmation before proceeding to the next step
- If issues occur: Summarize them, suggest potential resolutions, and ask for direction
- Never proceed automatically if errors are detected
- **NEVER use `--show-secrets`** - this would expose secrets to external models
- Use the Troubleshooting section at the bottom if issues occur

## Steps

### Step 0: Preparation (Start Here)

**Tell user**: "First, I'll check your current state and see if there are any pending infrastructure changes before we pull new code."

**Run these commands**:

```bash
# Check for uncommitted changes
git status

# Check current infrastructure state
pulumi preview --diff
```

**If git status shows uncommitted changes**:

- **Ask user**: "You have uncommitted changes. Do you want to: (a) stash them, (b) commit them, or (c) abort upgrade?"
- Wait for user to resolve before continuing

**If pulumi preview shows changes**:

- **Tell user**: "There are pending infrastructure changes (likely version updates or config drift). It's best to apply these before pulling new code."
- **Show user**:

    ```
    👉 Run in your terminal (or use !command in OpenCode):

       pulumi up
    ```

- Wait for user to confirm changes are applied
- Run `pulumi preview --diff` again to verify clean state

**When both are clean**, proceed to Step 1.

---

### Step 1: Analyze Incoming Changes

**Tell user**: "I'll check for incoming changes and identify any breaking changes that require special handling."

**Run these read-only commands**:

```bash
# Get current version
cat package.json | grep '"version"'

# Fetch latest from GitHub
git fetch origin

# Check for incoming changes (overview)
git log HEAD..origin/main --oneline

# Get full commit messages to find BREAKING CHANGE entries
git log HEAD..origin/main
```

**To check for major releases** (try `gh` first, fall back to WebFetch):

```bash
# Try gh first (saves tokens)
gh release list --repo QC-Labs/orange-lab --limit 5
```

If `gh` is not configured, use WebFetch: `https://github.com/QC-Labs/orange-lab/releases`

**Analyze the output for USER-FACING breaking changes**:

A breaking change is ONLY something that requires the user to modify their `pulumi config`. Look for:

- Commits containing "BREAKING CHANGE:" in their body - these contain migration instructions
- Release notes sections titled "BREAKING CHANGES" or "UPGRADE ACTIONS"
- Config key renames (e.g., `app:oldKey` → `app:newKey`)
- Removed config options that the user may have set
- New required config options

**NOT breaking changes** (ignore these):

- Internal code refactoring (changing how code is structured internally)
- Dependency updates
- Moving config access from one internal pattern to another
- Any change that doesn't require user action in `pulumi config`

**Example**: A commit saying "refactor: config now uses `config.require()` directly" is internal code cleanup, NOT a breaking change. The user's config file is unchanged.

**If user-facing breaking changes found**, check which apps are affected by running:

```bash
pulumi config
```

Cross-reference breaking changes with enabled apps. If all affected apps are disabled (`enabled: false` or not configured), they don't require the full upgrade path.

**NEVER disable these components** (apply config migrations directly instead):

- **Longhorn** - Storage backend; disabling could remove storage volumes
- **cert-manager** - Stores certificates in CRDs; disabling would lose certs

Other infrastructure (Traefik, Tailscale) can be safely disabled and re-enabled.

---

### If NO breaking changes found (or only affect disabled apps) → Quick Upgrade Path

**Tell user**: "No breaking changes affect your enabled apps. We can do a simple upgrade."

**Show user commands**:

```
👉 Run in your terminal (or use !command in OpenCode):

   git pull --rebase origin main
   npm install
   npm test
```

**After user completes**, run preview:

```bash
pulumi preview --diff
```

**Analyze preview for safety**:

- Look for unexpected resource REPLACEMENTS or DELETIONS
- Minor updates (image versions, config changes) are expected and safe

**If preview looks safe**:

```
👉 Run in your terminal (or use !command in OpenCode):

   pulumi up
```

**After user applies**, verify:

```bash
kubectl get pods -A | grep -v Running | grep -v Completed
```

**If all pods healthy**, report success and END upgrade process.

**If preview shows concerning changes** (major replacements, deletions), continue to Step 2 for detailed analysis.

---

### If breaking changes affect ENABLED apps → Full Upgrade Path (Steps 2-11)

**Tell user**: "Breaking changes detected for enabled apps. We'll need to follow the full upgrade process to safely migrate."

**Report to user**:

```
Current version: [version from package.json]
Latest release: [version from GitHub]
Incoming commits: [count]

Breaking changes found:
- [list BREAKING CHANGE entries from git log, include full instructions]

Apps requiring action:
- [list apps that need disabling/config changes]
```

**Ask user**: "Continue to Step 2: Verify Storage Safety?"

### Step 2: Verify Storage Safety (Static Volumes)

**Tell user**: "Before making any changes, I'll verify your storage configuration. Apps using static volumes (`fromVolume`) can be safely disabled and re-enabled without losing data - the Longhorn volume just gets detached and can be reattached. Apps using dynamic volumes will lose their storage if disabled."

**IMPORTANT**: Never include Longhorn or cert-manager in the list of apps to disable. These are core infrastructure:
- **Longhorn** - Storage backend that manages all volumes; it doesn't use volumes itself
- **cert-manager** - Stores certificates in CRDs that would be lost if disabled

**Run this read-only command**:

```bash
pulumi config
```

**Analyze the output** focusing ONLY on apps with breaking changes from Step 1:

1. Check which of those apps have `enabled: true`
2. For each enabled app, check if `<app>:fromVolume` is configured
3. Identify apps with persistent storage but NO `fromVolume` set

**Report to user**:

```
Storage Safety Check (only for apps with breaking changes):

Apps with breaking changes that are enabled:
  [list apps from Step 1 that have enabled: true]

Storage configuration:
  app-name: enabled=true, fromVolume=x (static, safe to disable)
  app-name: enabled=true, NO fromVolume (WARNING - dynamic volume, data loss risk)

Apps with breaking changes that are disabled (no action needed):
  [list disabled apps]
```

**If any ENABLED apps with breaking changes are missing `fromVolume`**:

1. **WARNING**: Tell user: "This app uses a dynamic volume. If we disable it, the PersistentVolume and its data will be deleted."
2. **Show user commands** to convert to static volume:

    ```
    👉 Run in your terminal (or use !command in OpenCode):

       # Set storageOnly to keep volume while disabling app resources
       pulumi config set <app>:storageOnly true
       pulumi up

       # Then clone volume in Longhorn UI with descriptive name (e.g., app name)
       # Finally, attach the static volume:
       pulumi config set <app>:fromVolume <volume-name>
       pulumi config delete <app>:storageOnly
    ```

3. **Ask user**: "Have you set up static volumes for these apps, or do you accept the data loss risk?"

**Ask user**: "Continue to Step 3: Extract and Save Secrets?"

### Step 3: Extract and Save Secrets

**Tell user**: "Before disabling apps, you need to save encryption keys and database passwords to your Pulumi config. This ensures the same credentials are used when re-enabling apps. You must run these commands yourself - I cannot see secrets."

**IMPORTANT: You (LLM) must NOT run any `--show-secrets` commands.** The user must handle secrets directly.

**Apps with secrets**: `n8n` (encryption key + PostgreSQL), `nextcloud` (MariaDB), `mempool` (MariaDB)

**Tell user**: "Check which apps from Steps 1-2 are ENABLED and need secrets saved. Look up the config key names in `components/<category>/<app>/<app>.ts` and output paths in `pulumi stack output --json`."

**Show user commands to run in their terminal**:

```
👉 Run in your terminal (NOT in OpenCode - secrets should stay local):

   # View all outputs to find your app's secrets
   pulumi stack output --show-secrets --json

   # Get secret value and save to config
   pulumi stack output <module> --show-secrets --json | jq -r '.<app>.<path>'
   pulumi config set <app>:<config-key> "<value>" --secret
```

**Tell user**: "Run the relevant commands for your ENABLED apps. Don't share the output with me. Type 'done' when complete."

**When user types "done", run verification**:

```bash
pulumi config
```

**Verify** the relevant secret configs are present for the apps being disabled. If any are missing, ask user to run the commands again.

**Why this matters**:

- **Encryption keys**: Without the original key, encrypted data (like n8n workflow credentials) cannot be decrypted
- **Database passwords**: When apps are re-enabled, the password must match what's stored in the database

**If secrets are not in outputs** (app was never deployed):

- For fresh installs, secrets will be auto-generated on first deploy
- For recovery from backup, see `components/data/mariadb-operator/mariadb-operator.md` for MariaDB reset procedure

**Ask user**: "Continue to Step 4: Update K3s Nodes?"

### Step 4: Update K3s Nodes

**Tell user**: "It's recommended to update K3s on your cluster nodes to apply configuration changes."

**Run these commands** to display the update scripts:

```bash
cat ./scripts/k3s-server.sh
echo "---"
cat ./scripts/k3s-agent.sh
```

**Explain to user**:

- The scripts generate k3s install commands with correct configuration
- Server script updates the K3s control plane node
- Agent script updates K3s worker nodes

**Show user instructions**:

```
👉 Run these steps on your nodes (SSH required):

   K3s agent update (run on each agent node):
     1. SSH to agent: ssh root@<agent-node>
     2. Copy the agent script content shown above
     3. Execute it
     4. Verify: systemctl status k3s-agent.service

   K3s server update (run on your server node):
     1. SSH to server: ssh root@<server-node>
     2. Copy the server script content shown above
     3. Execute it
     4. Verify: systemctl status k3s.service
```

**After user confirms nodes updated, verify** by running:

```bash
kubectl get nodes -o wide
kubectl get nodes --show-labels
```

**Explain required labels**:

- `node-role.kubernetes.io/longhorn=true` - at least one node needed for Longhorn storage
- `topology.kubernetes.io/zone=home` - for location-aware apps like home-assistant
- GPU nodes are automatically detected and labeled by Node Feature Discovery (NFD)

**If node labels need updating**, show user:

```
👉 Run in your terminal (or use !command in OpenCode):

   kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true
   kubectl label nodes <node-name> topology.kubernetes.io/zone=home
```

**Ask user**: "Have you updated your K3s nodes and verified labels? Continue to Step 5: Disable Apps?"

### Step 5: Disable Apps with Breaking Changes

**Tell user**: "I'll guide you to disable apps that have breaking changes. Since we verified static volumes are configured, the Longhorn volumes will be detached (not deleted) and can be reattached after the upgrade."

**NEVER disable**: Longhorn, cert-manager (see Step 1). For these, apply config migrations directly.

**Apps with manual uninstall steps** (check `components/<category>/<app>/<app>.md` "Uninstall" section if disabling):
- `tailscale` - Remove leftover machines with `tag:orangelab` at https://login.tailscale.com/admin/machines, delete CRDs
- `cloudnative-pg` - Delete CRDs (required before reinstalling)
- `prometheus` - Disable component monitoring first, then delete CRDs
- `nfd` - Delete CRDs
- `amd-gpu-operator` - Delete CRDs

**Show user the commands** for apps identified in Step 1 (excluding Longhorn/cert-manager):

```
👉 Run in your terminal (or use !command in OpenCode):

   pulumi config set <app>:enabled false
   # Repeat for each app that needs to be disabled
```

**After user disables apps, run preview**:

```bash
pulumi preview --diff
```

**Analyze the preview**:

- Look for PersistentVolume and PersistentVolumeClaim being removed
- Explain this is EXPECTED - the underlying Longhorn volume persists
- Check that only the intended apps are being disabled

**Tell user**: "Preview shows [X] apps will be disabled. The PersistentVolumes will be removed, but Longhorn volumes persist (they'll show as 'Detached' in Longhorn UI)."

**Show user the apply command**:

```
👉 Review the preview above. If it looks correct, run:

   pulumi up
```

**After user applies**, ask them to share the output or confirm success.

```
Apps disabled:
- [list of apps from user's report]

Resources removed:
- Application resources (Deployment, Service, Ingress) removed
- PersistentVolume/PersistentVolumeClaim removed (Longhorn volumes detached)
```

**Ask user**: "Continue to Step 6: Pull Latest Changes?"

---

### Step 6: Pull Latest Changes

**Tell user**: "Now we need to pull the latest code changes using git rebase to keep your history clean."

**Check for uncommitted changes** by running:

```bash
git status
```

**If there are uncommitted changes**, ask user: "You have uncommitted changes. Do you want to: (a) stash them, (b) commit them, or (c) abort upgrade?"

**Show user commands to pull and update**:

```
👉 Run in your terminal (or use !command in OpenCode):

   git pull --rebase origin main
   npm install
   npm test
```

**After user completes**, verify by running:

```bash
git log --oneline -5
npm test
```

**Report to user**:

```
Pull status: [success/failure]
Merge conflicts: [none/resolved]
Tests: [passed/failed]
```

**If merge conflicts**, STOP and help user resolve them.

**Ask user**: "Continue to Step 7: Preview Infrastructure Changes?"

---

### Step 7: Preview Infrastructure Changes

**Tell user**: "I'll run a Pulumi preview to check for any unexpected infrastructure changes before applying."

**Run preview**:

```bash
pulumi preview --diff
```

**Analyze the output carefully**:

1. Look for EXPECTED changes (from breaking changes identified in Step 1)
2. Look for UNEXPECTED changes
3. Look for resource replacements or deletions that seem wrong

**Report to user**:

```
Analysis of preview:

Expected changes:
- [list expected changes from breaking changes]

Unexpected changes:
- [list any unexpected changes] OR "No unexpected changes found"

Potential issues:
- [list any concerns like resource replacements]
```

**If unexpected changes found**, explain what they are and suggest investigation.

**Ask user**: "Preview looks correct. Continue to Step 8: Apply Infrastructure Changes?"

---

### Step 8: Apply Infrastructure Changes

**Tell user**: "Now we'll apply the infrastructure changes to upgrade your cluster."

**Show user the apply command**:

```
👉 Run in your terminal (or use !command in OpenCode):

   pulumi up
```

**After user applies**, ask them to share the output or report status.

**If user reports errors**:

1. STOP immediately
2. Summarize the error based on user's report
3. Suggest potential resolutions (see Troubleshooting section)
4. Ask user for direction before proceeding

**If successful**, report:

```
Deployment status: SUCCESS

Changes applied:
- [list key changes from user's output]
```

**Ask user**: "Continue to Step 9: Re-enable Previously Disabled Apps?"

---

### Step 9: Re-enable Previously Disabled Apps

**Tell user**: "I'll guide you to re-enable the apps that were disabled for the upgrade."

**Show user commands** for each app disabled in Step 5:

```
👉 Run in your terminal (or use !command in OpenCode):

   pulumi config set <app>:enabled true
   # Repeat for each app that was disabled in Step 5
```

**After user re-enables apps, run preview**:

```bash
pulumi preview --diff
```

**Report to user**:

```
Apps to re-enable:
- [list of apps being re-enabled]

Preview shows:
- [summary of resources being created]
```

**Ask user**: "Preview looks correct. Continue to Step 10: Deploy Re-enabled Apps?"

---

### Step 10: Deploy Re-enabled Apps

**Tell user**: "Now we'll deploy the re-enabled apps with their new configuration."

**Show user the apply command**:

```
👉 Run in your terminal (or use !command in OpenCode):

   pulumi up
```

**After user applies**, ask them to share the output or report status.

**If user reports errors**:

- STOP and summarize the error
- Check common issues:
    - Volume not found (fromVolume mismatch)
    - Database connection failed (database operator not running)
    - Database password mismatch (forgot to save in Step 3)
    - Encryption key mismatch (forgot to save in Step 3)
- Ask user for direction

**Report to user** for each app:

```
Deployment status for [app-name]: SUCCESS/FAILED

If failed: [error details from user]
```

**Ask user**: "When deployment is complete, type 'done' to continue to Step 11: Validate Upgrade."

---

### Step 11: Validate Upgrade

**Tell user**: "I'll verify that your services are running correctly by checking ingress endpoints and pod health."

**Run these read-only commands**:

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

**For endpoint health checks**, run or show user:

```bash
# For each endpoint URL from pulumi output
curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 <url>
```

**Check ingress controllers**:

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

**Report final upgrade status to user**:

```
╔════════════════════════════════════════════════════════════╗
║                    UPGRADE COMPLETE                        ║
╠════════════════════════════════════════════════════════════╣
║ Version upgraded: X.X.X -> Y.Y.Y                           ║
║ Apps upgraded: [list]                                      ║
║ Endpoints verified: [list]                                 ║
║ Ingress mode: [Traefik with custom domain / Tailscale]     ║
║                                                            ║
║ Status: SUCCESS / PARTIAL / FAILED                         ║
║                                                            ║
║ Remaining issues:                                          ║
║ - [any issues or manual steps needed]                      ║
╚════════════════════════════════════════════════════════════╝
```

**If validation failed**, list problems found and suggest fixes from Troubleshooting section.

---

# TROUBLESHOOTING

Use this section when issues occur during any step.

## Common Issues

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

## Recovery Options

Guide user with these commands if needed:

- **Rollback code**: `git checkout <previous-commit>`
- **Rollback infrastructure**: Pulumi maintains state history, but app data may be affected
- **Skip problematic app**: `pulumi config set <app>:enabled false` and continue with rest of upgrade
- **Restore from backup**: Use Longhorn UI to restore volume from backup, then `pulumi config set <app>:fromVolume <volume-name>`

---

# REFERENCE

## Command Summary

**LLM can safely run (read-only)**:

- `pulumi config` (NO `--show-secrets`)
- `pulumi preview --diff`
- `pulumi stack output --json` (NO `--show-secrets`)
- `git status`, `git log`, `git fetch`, `git diff`
- `kubectl get ...` (any read operations)
- `gh release list`, `gh release view` (if configured)
- WebFetch for GitHub releases page (fallback)
- `npm test`
- `cat`, `curl` for reading files/endpoints

**User must run** (in terminal or via `!command` in OpenCode):

- `pulumi up`
- `pulumi config set ...`
- `pulumi config delete ...`
- `git pull`, `git checkout`, `git stash`
- `npm install`
- `kubectl label ...`
- Any command with `--show-secrets`
- SSH commands to nodes
