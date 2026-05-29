---
name: update-stacks
description: Use when the user asks to update, deploy, or apply changes to all Pulumi stacks (core and all stacks in the stacks/ folder). Trigger on phrases like "update all stacks", "deploy all stacks", "pulumi up all", or "apply all stacks".
---

# Update Stacks

Updates the core stack and all child stacks in the `stacks/` folder.

## Workflow

### 1. Build the project

Compile shared packages first:

```
npm run build
```

### 2. Discover stacks dynamically

- **Core stack**: Look for `Pulumi.<stack>.yaml` in the project root. Use that stack name.
- **Child stacks**: For each subdirectory in `stacks/`, look for `Pulumi.<stack>.yaml`. Collect all stack names.

### 3. Preview all stacks

Run previews in parallel where safe:

- Preview the **core** stack first (alone)
- Preview all **child stacks** in parallel

```
pulumi preview --json -s <stack-name>
```

If a stack has no changes, note that. Otherwise, extract from JSON:
- `create`, `update`, `delete`, `replace` counts
- Any policy violations or errors

### 4. Summarize and ask for confirmation once

Present a table:

| Stack | Create | Update | Delete | Replace | Status |
|-------|--------|--------|--------|---------|--------|
| lab (core) | 2 | 5 | 0 | 1 | changes |
| lab-apps | 0 | 0 | 0 | 0 | no changes |
| lab-ai | 1 | 3 | 0 | 0 | changes |

Then ask: **"Apply all stacks?"** (yes/no). Do not proceed without explicit confirmation.

### 5. Update core stack first

```
pulumi up --yes -s <core-stack-name>
```

Wait for completion. If this fails, **stop** and report the error. Do not update child stacks.

### 6. Update child stacks in parallel

Run all child stacks simultaneously:

```
pulumi up --yes -s <child-stack-name>
```

### 7. Report results

Present a final summary:

| Stack | Result | Notes |
|-------|--------|-------|
| lab (core) | ✅ success | |
| lab-apps | ✅ success | no changes |
| lab-ai | ❌ failed | error message |

For failures, include the last few lines of the error output so the user can diagnose.
