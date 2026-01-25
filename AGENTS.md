# OrangeLab Guidelines

## Commands

- Deployment: `pulumi up --yes` (only with user approval)
- Preview changes: `pulumi preview --diff` (useful for checking for any unintended changes after major code updates or refactoring)
- Test: `npm test`

## Architectural Principles

- **Simplicity Over Complexity (KISS):** Prioritize simple, straightforward solutions. Avoid over-engineering or introducing complex patterns without consultation.
- **You aren't gonna need it (YAGNI):** Only implement features and functionality that are required now. Avoid building for hypothetical future scenarios.
- **Loose Coupling:** Strive to keep components independent. Avoid creating circular dependencies.
- **Single Responsibility:** Each class has one clear purpose: Metadata for labels/annotations, Network for ingress/services, Storage for volumes, etc.

## Working Conventions

### Step-by-Step Approach

- Agree on plan first before making changes
- Ask questions about trade-offs if multiple paths exist
- Work incrementally on one task at a time
- Ask for confirmation before moving to next phase

### Asking for Confirmation

- Before implementing significant changes, discuss the proposed approach and alternatives first
- When working through multiple files, show a brief diff/context before asking to proceed
- Keep descriptions concise and focused on the specific change

### Commit Messages

- Use conventional commits: `scope:` or `fix(scope):` for normal changes and bug fixes, `scope!: BREAKING CHANGE` for breaking changes
- Include why the change matters (e.g., "shows up in Headlamp in Cluster/Nodes")
- Don't use "refactor:" for breaking changes

### Kubernetes Standards

- Prefer standard Kubernetes conventions unless there's a specific reason to deviate
- Example: node-role labels use `true` value to match k3s `control-plane` and `master` roles

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

### Type Safety

- Always use explicit types
- Avoid `any` type
- Prefer `variable?: Type` over `variable: Type | undefined`
- Prefer optional chaining over null checks
- Prefer nullish coalescing operator (??) over logical OR (||)
- Prefix unused variables with underscore (\_)

### Secrets and Security

- Use `envSecret` field in `ContainerSpec` for sensitive data instead of command args
- Application class automatically creates Kubernetes Secrets and configures envFrom
- Environment variable names should be UPPERCASE following conventions
- Never expose passwords or sensitive data in command line arguments

## Components

- Applications should use the Application class for Kubernetes resources
- For Helm charts, use Application class for namespaces and storage
- Follow the established pattern for new modules and components
- Use constructor parameter properties with access modifiers (e.g., `constructor(private readonly args: Args)`)
- Prefer composition over inheritance for component relationships
- Only export fields when needed for external use; keep sensitive values like auth keys internal when not required
- Share provider instances across components (pass via args) rather than creating duplicates
