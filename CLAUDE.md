# OrangeLab Commands & Style Guide

## Build/Lint/Test Commands

-   Deployment: `pulumi up`
-   Lint: `npm run lint`
-   Test: `npm run test` (runs lint)

## Code Style

### General

-   TypeScript with strict type checking
-   Pulumi for infrastructure as code
-   Modular architecture with clear separation of concerns

### Naming Conventions

-   Use camelCase for variables, functions, and methods
-   Use PascalCase for classes, interfaces, and type aliases
-   Prefix private class members with underscore (\_)

### Import/Export Style

-   Group imports by external packages first, then internal modules
-   Use destructuring imports when appropriate
-   Sort imports alphabetically within each group

### Error Handling

-   Use assert for validations that should never fail
-   Prefer TypeScript's strict null checking
-   Use optional chaining (?.) for potentially undefined values

### Type Safety

-   Always use explicit types
-   Avoid `any` type
-   Prefer `variable?: Type` over `variable: Type | undefined`
-   Prefer optional chaining over null checks
-   Prefix unused variables with underscore (\_)

### Components

-   Applications should use the Application class for Kubernetes resources
-   Follow the established pattern for new modules and components
