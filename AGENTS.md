# OrangeLab Guidelines

## Commands

- Deployment: `pulumi up --yes` (only with user approval)
- Preview changes: `pulumi preview --diff` (useful for checking for any unintended changes after major code updates or refactoring)
- Build/Test/TypeCheck (TypeScript only): `npm test`
    - ⚠️ SKIP for markdown/documentation changes - no need to run

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

### Step-by-Step Approach

- Agree on plan first before making changes
- Ask questions about trade-offs if multiple paths exist
- Work incrementally on one task at a time
- Ask for confirmation before moving to next phase

### Architecture Planning

- Present the architecture plan before implementing multi-file changes
- Validate the approach with user before writing code to avoid rework
- Focus on interfaces and data flow rather than implementation details

### Asking for Confirmation

Stop and ask when you encounter:

- **Comments indicating multiple values**: e.g., `// info, debug, dev` suggests more complexity than a boolean
- **Inconsistent patterns**: same concept handled differently in different files
- **Configuration that maps to multiple levels**: debug might be true/false in one place but have granular levels elsewhere
- **Deprecation markers**: comments about future changes or TODOs
- **Type mismatches**: a value used as boolean in one place but string/enum in another

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
