---
description: Update npm dependencies with locked versions and validate infrastructure
---

Update npm dependencies in this project, ensuring all versions are properly locked and no infrastructure changes are introduced.

## Steps

### Analyze the current state:

- Run `npm outdated` to see available updates
- Run `npm audit` to check for security vulnerabilities

### Categorize updates:

- Patch updates (1.0.0 → 1.0.1): Generally safe
- Minor updates (1.0.0 → 1.1.0): Should be backwards compatible
- Major updates (1.0.0 → 2.0.0): May have breaking changes

### Provide update plan

Show me:

- Which packages you recommend updating
- Current version → New version
- Type of update (patch/minor/major)
- Any potential breaking changes to watch for
- Packages that should NOT be updated (with reasons)

### Update package.json ONLY with these rules:

- Use exact versions (no `^` or `~` prefixes)
- Format: "package-name": "1.2.3" not "package-name": "^1.2.3"
- Keep dependencies alphabetically sorted
- Separate devDependencies from dependencies
- DO NOT edit package-lock.json

### Update dependencies

- Run `npm install` to regenerate package-lock.json
- Verify installation completes without errors

### Validate infrastructure state

- Run `pulumi preview` to check for infrastructure changes
- CRITICAL: The preview output should show "no changes" or "0 to update"
- If any infrastructure changes appear, investigate why and report back

## Important Rules

✅ Lock all versions without `^` or `~`
✅ Only edit package.json, never package-lock.json directly
✅ Always run `npm install` after updating package.json
✅ Always run `pulumi preview` to validate no infra drift
✅ Check CHANGELOG for breaking changes
✅ Keep Node engine compatibility in mind
✅ Preserve any custom scripts or configurations
❌ Don't update everything blindly
❌ Don't break peer dependency requirements
❌ Don't proceed if pulumi preview shows unexpected changes

## Context Needed

Please provide:

- Current `package.json` content
- Output of `npm outdated`
- Output of `npm audit` (if any vulnerabilities)
- Node version being used
- Any known compatibility requirements

## Expected Output

1. Analysis of outdated packages
2. Recommended update strategy
3. Updated `package.json` with locked versions
4. Confirmation that `npm install` completed successfully
5. Confirmation that `pulumi preview` shows no infrastructure changes
6. List of any manual testing needed after updates

## Validation Checklist

- [ ] package.json updated with exact versions
- [ ] npm install completed without errors
- [ ] package-lock.json regenerated
- [ ] pulumi preview shows no changes
- [ ] No peer dependency warnings
- [ ] All tests pass (if applicable)
