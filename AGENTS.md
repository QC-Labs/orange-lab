# OrangeLab Guidelines

## Commands

- Confirm with the user before running any command that changes the state of the cluster (e.g. `pulumi up`, `kubectl apply/delete`, `helm install/upgrade`, `kubectl rollout restart`). Read-only analysis commands (`kubectl get`, `pulumi preview`, `logs`, `describe`) do not need explicit approval.
- Deployment: `pulumi up --yes` (only with user approval)
- Preview changes: `pulumi preview --diff` (useful for checking for any unintended changes after major code updates or refactoring)
- Build/Test/TypeCheck (TypeScript only): `npm test`
    - ⚠️ SKIP for markdown/documentation changes - no need to run
- Build `@orangelab/pulumi` after editing `packages/pulumi/src/`: `npm run build` (must be run before `pulumi up` or `pulumi preview`)

## Architectural Principles

- **Simplicity Over Complexity (KISS):** Prioritize simple, straightforward solutions. Avoid over-engineering or introducing complex patterns without consultation.
- **You aren't gonna need it (YAGNI):** Only implement features and functionality that are required now. Avoid building for hypothetical future scenarios.
- **Loose Coupling:** Strive to keep components independent. Avoid creating circular dependencies.
- **Single Responsibility:** Each class has one clear purpose: Metadata for labels/annotations, Network for ingress/services, Storage for volumes, etc. Extract functionality into separate files/classes when components have distinct responsibilities, even if they seem related (e.g., init containers handle volume preparation while runtime containers handle main workloads with GPU support).
- **Encapsulation of Complexity:** Complex logic should be encapsulated within classes. Expose clean interfaces rather than leaking implementation details.

## Commit Messages

- Use conventional commits: `scope:` or `fix(scope):` for normal changes and bug fixes, `scope!: BREAKING CHANGE` for breaking changes
- One line is usually sufficient; add detailed description only for breaking changes explaining how to migrate
- Include why the change matters (e.g., "shows up in Headlamp in Cluster/Nodes")
- Don't use "refactor:" for breaking changes

## Working Conventions

### Workflow Phases

Follow these phases in order. Do NOT skip to implementation without completing the earlier phases. Implementation is the LAST step.

1. **Understand**: Start with a quick assessment of the situation — gather key symptoms and surface possible investigation tracks. Present these to the user early so they can provide additional context, reject paths they know are dead ends, or suggest simpler fixes (e.g., "just restart the service"). Only dive deep into logs/code paths if the quick assessment doesn't reveal an obvious fix or the user confirms the direction. Avoid long debugging sessions with diminishing returns — if deep investigation isn't converging, stop and discuss findings so far.
2. **Discuss**: Present findings and potential solutions with trade-offs. Ask the user to choose direction when multiple paths exist. Do not implement yet.
3. **Plan**: Once direction is agreed, present a concrete implementation plan (files to change, what changes, verification steps). Get explicit confirmation before proceeding.
4. **Implement**: Only after the plan is confirmed, make the changes. Run build/test/typecheck. Report results.
5. **Verify**: Confirm the changes work (preview, deploy, test). Report results and stop — let the user decide next steps.

### Switching Back to Discussion Mode

During implementation, stop and switch back to discussion mode when:

1. **Library change may be needed**: If the implementation would require manual Kubernetes manifests or workarounds to accomplish something the library (`@orangelab/pulumi`) should handle, stop. Propose the library change instead so other components can reuse it. Keep stacks clean and delegate to the Application class wherever possible.
2. **Scope changes or faulty assumptions surface**: If something unexpected comes up during implementation (a conflict, a wrong assumption, a side effect), stop. Note the issue and agree on a path forward before continuing. The user may have context outside the current session, or may want to defer the fix to a separate task.

### Asking for Confirmation

Stop and ask when you encounter:

- **Comments indicating multiple values**: e.g., `// info, debug, dev` suggests more complexity than a boolean
- **Inconsistent patterns**: same concept handled differently in different files
- **Configuration that maps to multiple levels**: debug might be true/false in one place but have granular levels elsewhere
- **Deprecation markers**: comments about future changes or TODOs
- **Type mismatches**: a value used as boolean in one place but string/enum in another
- **Defaults from a single use case**: when generalizing code into a library, a hardcoded value that matched the original caller (e.g., a port) may not be a sensible default. Check whether the value is universal or app-specific — make app-specific values required parameters.

Even if the change seems straightforward, these signals may indicate the current pattern is intentionally simplified (YAGNI) or needs expansion.

## Code Style

### General

- TypeScript with strict type checking
- Pulumi for infrastructure as code
- Modular architecture with clear separation of concerns
- Prefer self-documenting code over comments
- Use descriptive variable names and clear function signatures
- Keep the code concise omitting default values unless useful to communicate intent
- Pass dependencies through args (providers, config, metadata) rather than accessing globals (except `config.ts`)

### Naming Conventions

- Use camelCase for variables, functions, and methods
- Use PascalCase for classes, interfaces, and type aliases

### Import/Export Style

- Group imports by external packages first, then internal modules
- Use destructuring imports when appropriate
- Sort imports alphabetically within each group

### Error Handling

- Use assert for validations that should never fail
- Prefer TypeScript's strict null checking
- Use optional chaining (?.) for potentially undefined values

### Method Size

- Keep methods around 20 lines or less
- Simple operations (single `.map()`, `.filter()`) should be inlined rather than extracted into private methods
- Outliers exist for orchestration methods that coordinate multiple steps

### Type Safety

- Always use explicit types
- Avoid `any` type
- Prefer `variable?: Type` over `variable: Type | undefined`
- Prefer optional chaining over null checks
- Prefer nullish coalescing operator (??) over logical OR (||)
- Prefix unused variables with underscore (\_)

### Kubernetes Standards

- Prefer standard Kubernetes conventions unless there's a specific reason to deviate
- Example: node-role labels use `true` value to match k3s `control-plane` and `master` roles

## Components

- Applications should use the Application class for Kubernetes resources
- For Helm charts, use Application class for namespaces and storage
- Follow the established pattern for new modules and components
- Use constructor parameter properties with access modifiers (e.g., `constructor(private readonly args: Args)`)
- Prefer composition over inheritance for component relationships
- Only export fields when needed for external use; keep sensitive values like auth keys internal when not required
- Share provider instances across components (pass via args) rather than creating duplicates

### Initialization Order

When a value from `Application` (like `this.app.debug`) is needed during chained initialization, create the Application instance first: `this.app = new Application(...);`, then continue with chained methods: `this.app.addStorage().addConfigVolume(...)`.

## Configuration

- **Pulumi stack files**: Never modify `Pulumi.*.yaml` files directly. Use `pulumi config set <key> <value>` (or `pulumi config set --secret <key> <value>`) instead. If a change to these files is needed, inform the user what commands or values to update rather than editing the files yourself.
- **Reading settings**: Use `pulumi config get <key>` command to read configuration values. Do NOT read `Pulumi.*.yaml` files directly as they may contain secrets.
- Don't use optional accessors (`?.`, `??`) for settings that have defaults defined in `Pulumi.yaml`
- Use `config.require()` instead of `config.get()` when a default value exists in `Pulumi.yaml`
- This prevents typos by ensuring all expected settings are present and simplifies processing logic
- **Feature-gated validation**: When a feature is conditionally enabled (e.g., `smtp/enabled`), validate its required settings only when that feature is enabled. This allows Pulumi.yaml to have defaults for optional features without forcing users to set them.
- **Conditional requirements**: When a feature is enabled, all its related settings should typically be required (`config.require`), not optional. The `enabled` flag acts as the conditional gate.
- **Minimal config generation**: Only generate config files when a feature requiring them is enabled. Don't create ConfigMaps/Secrets for unused features.
- **Derive don't duplicate**: Values that can be derived from existing resources (like URLs from `HttpEndpointInfo`) should be derived, not manually configured.
- **Naming Configuration Settings**: When settings map to environment variables in containers, use the exact environment variable name as the setting name. This makes it immediately obvious which env var a setting configures. Example: `DNS_SERVER_FORWARDERS` instead of `forwarders` when setting `DNS_SERVER_FORWARDERS` env var.

### Secrets and Security

- Use `envSecret` field in `ContainerSpec` for sensitive data instead of command args
- Application class automatically creates Kubernetes Secrets and configures envFrom
- Environment variable names should be UPPERCASE following conventions
- Never expose passwords or sensitive data in command line arguments

### Auto-generated Secrets

When a component generates secrets/tokens automatically (e.g., encryption keys), provide instructions in the component docs for:

1. Retrieving the secret from stack outputs after first deployment
2. Saving it to config with `--secret` flag for backup restoration

Example: n8n, vaultwarden

## Documentation

### Module Documentation (`<module>/MODULE.md`)

1. Short description and important things user needs to know before installing
2. TLDR section with code block containing only settings user must set or is very likely to change
    - Single-line comments: `# (Optional) ...`, `# (Recommended) ...`
    - Omit defaults (e.g., storageSize if using default)
3. List of existing components with links to component docs
4. "Experimental" and "Obsolete" sections only if components exist in those categories

### Component Documentation (`<component>/<component>.md`)

1. **Links table**: Homepage, Source code, Documentation, Helm chart/values (if used), Endpoints
2. **Short description** followed by code section with:
    - Required settings to get it running
    - Optional/likely settings with single-line comments
    - Comments only when command needs explanation
3. **Additional sections** only for complex topics needing more than a code comment
4. **Uninstall section** only when manual cleanup required (CRDs, etc.)
