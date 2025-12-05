# OrangeLab Commands & Style Guide

## Build/Lint/Test Commands

- Deployment: `pulumi up`
- Preview changes: `pulumi preview --diff`
- Lint: `npm run lint`
- Test: `npm run test` (runs lint)

## Architectural Principles

- **Simplicity Over Complexity (KISS):** Prioritize simple, straightforward solutions. Avoid over-engineering or introducing complex patterns without consultation.
- **Loose Coupling:** Strive to keep components independent. Avoid creating circular dependencies.
- **Consult on Architectural Changes:** Before implementing significant architectural changes (e.g., introducing new base classes, changing configuration management), discuss the proposed approach and alternatives first.
- **Centralized Concerns:** Keep related logic together. For example, all user-facing console output should ideally be handled in a single, designated component like `root-config.ts` to ensure consistency.

## Code Style

### General

- TypeScript with strict type checking
- Pulumi for infrastructure as code
- Modular architecture with clear separation of concerns
- Prefer self-documenting code over comments
- Use descriptive variable names and clear function signatures

### Naming Conventions

- Use camelCase for variables, functions, and methods
- Use PascalCase for classes, interfaces, and type aliases
- Prefix private class members with underscore (\_)

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

### Components

- Applications should use the Application class for Kubernetes resources
- For Helm charts, use Application class for namespaces and storage
- Follow the established pattern for new modules and components
- Use constructor parameter properties with access modifiers (e.g., `constructor(private readonly args: Args)`)
- Prefer composition over inheritance for component relationships

### Secrets and Security

- Use `envSecret` field in `ContainerSpec` for sensitive data instead of command args
- Application class automatically creates Kubernetes Secrets and configures envFrom
- Environment variable names should be UPPERCASE following conventions
- Never expose passwords or sensitive data in command line arguments
