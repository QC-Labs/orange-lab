---
name: document-module
description: Use when the user asks to create, update, or revise documentation for a stack module — typically the `README.md` at `stacks/<module>/README.md`. Trigger on phrases like "document `<module>` stack", "update `<module>` README", "write stack README", "add module docs". Distinct from `document-app` (per-component docs); a module README is the entry point that lists and links its components.
---

# Document Module

Creates or updates the `README.md` for a stack module. The README is the stack's entry point: a short description, a linked list of components, and enablement steps for recommended groupings. Keep it a navigational index — details live in each component's `<app>.md`. Deploy/stack-init steps live in `docs/stacks.md`, not here.

## Scope

Stay within the user's requested scope. When asked for a narrow update (e.g. "add the new component to the list", "fix the deploy block"), make only those changes. Do not silently fix other out-of-sync items you notice — instead, surface them as a list at the end so the user can decide what to address next. The verify step below checks the whole README, but its findings outside the requested scope are reported, not applied.

## General structure

1. `# <Stack> Stack` H1 — `<Stack>` is the module name capitalized (e.g. `Media`, `AI`, `Bitcoin`)
2. One-line description of the stack's purpose
3. `**Prerequisite**: Core stack must be deployed first (...)` — parenthetical lists the core-stack capabilities the module depends on
4. `## Components` — bulleted, linked list with short descriptions
5. (Optional) `## Configure Applications` — `### <App>` subsections enabling recommended components
6. (Optional) `## Migrate from Root Stack` — only for stacks split out from the root stack

## Components

Bulleted list, one row per component. Link target is relative from the README's directory: `./components/<app>/<app>.md`.

```
- [<App>](./components/<app>/<app>.md) — <short description>
```

- Separator is `—` (em dash), matching the `document-app` skill's convention
- Short description is one phrase, no trailing period
- Suffix `(experimental)` or `(deprecated)` when the component doc's H1 carries it — keep the README list in sync with the component docs
- Order: recommended/primary components first, then secondary, then `(experimental)` and `(deprecated)` last

Optional or uncommon components appear **only** in this list — they are not repeated in `## Configure Applications`. That section is for recommended groupings.

Every component imported by `stacks/<module>/index.ts` should have a row. If `index.ts` imports a component with no doc, surface it — don't add a row pointing at a missing file.

## Configure Applications

Include only when the stack has components that need explicit enablement. One `### <App>` H3 per component (or `### <App> + <App>` when components are deployed together as a group).

Each subsection is a single `sh` block:

```
pulumi config set <app>:enabled true
# (Recommended) <key> <value>
# (Optional) <key> <value>
pulumi up
```

- Comment prefixes match `document-app`: no prefix for required, `# (Recommended)` for most users, `# (Optional)` for skippable
- End each block with `pulumi up`
- Group coupled components under one H3 (e.g. `### Jellyfin + *arr Stack`, `### DroppedNeedle + slskd - Music`)
- Sub-subsections (`#### ...`) are fine inside a grouped H3 when the group splits into independent enablement blocks

Derive config keys from the component's `<app>.ts` and the stack's `Pulumi.yaml` — never guess.

## Migrate from Root Stack

Include only when the stack was split out from the root stack (e.g. `ai`, `bitcoin`). Two-part prose + two `sh` blocks:

1. Explain: plain values copy across `Pulumi.<stack>.yaml`; secrets need re-encryption because stack keys differ
2. First block runs in the root stack: `pulumi config get --secret <key>` for each secret
3. Second block runs in the new stack: `pulumi config set --secret <key> <value>` for each

List the component groups that need migration in a comment inside the first block (e.g. `# copy all settings from: ollama,open-webui,...`).

## Prerequisite line

`**Prerequisite**: Core stack must be deployed first (...)`. The parenthetical names the specific core-stack capabilities the module depends on — typically `network, storage`; add `, and data operators` (or similar) when a component needs an operator installed in the core stack (e.g. media needs `cloudnative-pg` for Immich, so its parenthetical is `network, storage, and data operators`). Don't pad with capabilities the module doesn't use.

## Relative links

- Component docs: `./components/<app>/<app>.md` (from the README's own directory)
- No cross-stack links in a stack README — cross-stack references belong in component docs or root `README.md`

## Verify

Before declaring done:

- Every component link resolves (use `glob` on `stacks/<module>/components/*/<app>.md`)
- Every component imported by `stacks/<module>/index.ts` has a row; no row points at a missing doc
- `(experimental)` / `(deprecated)` suffixes in the list match each component doc's H1
- Prerequisite parenthetical is accurate for the module's actual dependencies
- Every `pulumi config set <app>:<key>` in `## Configure Applications` matches a key in `Pulumi.yaml` or the component's `.ts` file
- No `npm test` / `npm run build` — markdown-only change

## Writing principles

- **Index, not manual.** The README points to component docs; it doesn't restate them. If a topic needs more than a one-line description, it belongs in the component's `<app>.md`.
- **Derive, don't guess.** Component list comes from `index.ts` imports; config keys from `Pulumi.yaml` and `.ts` files; descriptions from the component docs' one-line summary.
- **Recommended vs. optional.** `## Configure Applications` lists recommended groupings. Optional components live only in `## Components` — don't inflate `## Configure Applications` with every option.
- **Keep it tight.** A stack with one component and no recommended settings beyond enablement (e.g. `dev`) needs only description + prerequisite + list. Skip `## Configure Applications` when there's nothing to recommend beyond a single `pulumi config set <app>:enabled true` — that one line can live in the list description instead. Promote it to its own section when the component has recommended settings worth surfacing (e.g. `iot`).
