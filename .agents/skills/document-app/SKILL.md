---
name: document-app
description: Use when the user asks to create, update, or revise documentation for an application component — typically a `<app>.md` file under `stacks/<module>/components/<app>/`. Trigger on phrases like "document `<app>`", "write `<app>`.md", "update `<app>` docs", "add docs for `<app>`", "backfill `<app>` links". The components folder is a Pulumi convention; users think of these as applications, so the skill is named accordingly.
---

# Document Application

Creates or updates the `<app>.md` documentation file for an application component. The skill describes basic rules — a starting point, not a final document. App-specific sections are encouraged when warranted.

## Scope

Stay within the user's requested scope. When asked for a narrow update (e.g. "fix the links", "update the code block"), make only those changes. Do not silently fix other out-of-sync items you notice — instead, surface them as a list at the end so the user can decide what to address next. The verify step below checks the whole doc, but its findings outside the requested scope are reported, not applied.

## General structure

1. `# <App>` H1 — add `(experimental)` or `(deprecated)` suffix when applicable, matching the module's `README.md` component list
2. Links table
3. One-line description + optional integrations sentence linking to sibling component docs
4. Installation code block (ends at `pulumi up`)
5. (Optional) `## Post-Installation` — first-launch setup steps
6. (Optional) Other H2 sections as relevant (Prerequisites, Reset Password, Backup/Restore, app-specific)

## Links table

Two-column pipe table, no header row. All fields optional, but **Homepage**, **Source code**, and **Documentation** likely exist for most apps. Verify every URL with `webfetch` before writing.

Row order (skip rows that don't apply):

1. **Homepage** — project landing page
2. **Source code** — GitHub/forge repository URL
3. **Documentation** — official docs site/page
4. **Configuration** / **Environment variables** — dedicated config reference page, or source file when no dedicated page exists (e.g. ollama's `envconfig/config.go`)
5. **Docker Image** + **Dockerfile** — for image-based apps. Docker Image links to whatever registry the application publishes to (usually Docker Hub, sometimes GHCR) so the user can browse available tags. Dockerfile is the source path in the upstream repo. Name rows when the app ships multiple images (e.g. `Docker backend`, `Docker frontend`)
6. **Helm chart** + **Helm values** — for Helm-chart-based apps. Artifact Hub page or chart directory in the repo + link to the chart's `values.yaml`
7. **Endpoints** (last) — `https://<app>.<domain>/` (hostname from `Pulumi.yaml`, `<domain>` kept as literal placeholder)

Bespoke rows (e.g. `CLI commands`, `Model catalog`, `Tutorials`) only when warranted.

Example (image-based app):

```
|               |                                                     |
| ------------- | --------------------------------------------------- |
| Homepage      | https://example.com/                                |
| Source code   | https://github.com/org/repo                         |
| Documentation | https://docs.example.com/                           |
| Configuration | https://docs.example.com/env                         |
| Docker Image  | https://hub.docker.com/r/org/image                  |
| Dockerfile    | https://github.com/org/repo/blob/main/Dockerfile    |
| Endpoints     | `https://<app>.<domain>/`                           |
```

When updating the table, backfill missing rows. **Never remove a row without confirming with the user first** — a stale URL may just need an update.

## Installation code block

Single `​`sh` block, ends at `pulumi up`. No `pulumi stack output` line for the endpoint — endpoint retrieval is documented centrally in `docs/configuration.md` (`## Deploying Applications`).

Match the code-block heading convention used by sibling docs in the same module (the repo is inconsistent: `## Basic configuration`, `## Deployment`, `## Installation`, or no heading). Group under a named H2 only when the block grows beyond ~5 commands.

Comment prefixes:
- No prefix for required settings
- `# (Recommended)` for settings most users should set
- `# (Optional)` for settings most users can skip

Only include settings the component actually supports. Derive config keys from `<app>.ts` and `Pulumi.yaml` — never guess.

## Post-Installation

Include only if first-launch setup is required. Flat numbered list for simple apps; `### N.` H3 subsections when steps have sub-bullets or multi-line details. Prefix optional user-level steps with `(Optional)` in the heading. Preserve existing steps verbatim when updating.

## Other sections

Add H2 sections when a topic needs more than a code comment. Common examples:

- **Prerequisites** — cross-stack or cross-component prerequisites (own H2 + sh block)
- **Backup and Restore** / **Admin access** / **Database** — auto-generated secret persistence (`pulumi stack output ... | jq` to retrieve, `pulumi config set --secret` to persist)
- **Reset Admin Password** — exec + CLI
- **Upgrade** — post-upgrade recovery procedure
- **Custom images** — image swap guide with `### <variant>` H3s
- **Storage** — `storageOnly` and related flags
- **Hardware Acceleration**, **Permissions/SELinux**, **Rclone Backup**, **Models**, per-component integration (Arr Stack Integration, Wallet Configuration) — app-specific

One H2 per concern. App-specific sections not listed here are fine.

## Relative links

- Same-stack siblings: `../<other>/<other>.md`
- Cross-stack / cross-module (e.g. root-stack operator): `../../../../components/<group>/<app>/<app>.md`

## Verify

Before declaring done:

- Every `pulumi config set <app>:<key>` matches a key in `Pulumi.yaml` or the `.ts` file
- Every `pulumi stack output ... | jq` path (for secrets, not endpoints) matches what `index.ts` exports
- Every relative link resolves (use `glob`)
- Every helper script referenced by path exists (use `glob`)
- Every URL in the links table was verified with `webfetch`
- No `npm test` / `npm run build` — markdown-only change

## Writing principles

- **Derive, don't guess.** Config keys, env vars, output paths, and image names come from `.ts` files, `index.ts`, and `Pulumi.yaml`. Upstream URLs come from `webfetch`.
- **User, not contributor.** Show `pulumi config set ...`, not internal class names.
- **Keep it tight.** Simple apps need only a table, one-line description, short code block, and optional post-install list. Don't pad with H3 subsections that aren't needed.
- **No endpoint jq in the code block.** Endpoint goes in the table; retrieval is central in `docs/configuration.md`. Secret-retrieval jq lines belong in their H2 sections.
