---
description: Review staged code changes
---

Review staged code changes for quality, security, and adherence to OrangeLab's specific conventions.

## Steps

### Get the changes:

- Run `git diff --cached` to see staged changes
- **If no staged changes are found**: Check for modified files and ask the user if they would like you to review those instead. Do not proceed without confirmation.
- Identify the scope and type of changes (Infrastructure, Application logic, Metadata, etc.)

### Review for OrangeLab Principles:

- **Simplicity (KISS/YAGNI)**: Does the solution avoid over-engineering? Is it only implementing what's needed now?
- **Loose Coupling**: Are components independent? Any new circular dependencies?
- **Single Responsibility**: Do classes follow the established patterns (Metadata for labels, Network for ingress, etc.)?

### Technical Review:

- **TypeScript**: Strict type checking enforced? Any `any` types that should be replaced?
- **Infrastructure (Pulumi)**: Are new resources using the `Application` class? Are names and tags (like `tag:orangelab` for Tailscale) consistent?
- **Security**: Sensitive data handled via `envSecret` in `ContainerSpec`? No hardcoded secrets or passwords in command args?
- **Style**: camelCase for variables/functions, PascalCase for types/classes?

### Verification:

- **Linting/Tests**: Run `npm test` to ensure code matches project standards.
- **Infrastructure Preview**: Run `pulumi preview --diff` to verify intended infrastructure changes.

## Important Rules

✅ Use conventional commits (`scope:` or `fix(scope):`)
✅ Prefer composition over inheritance
✅ Pass dependencies through args (providers, config, metadata)
✅ `config` can be used to read common configuration settings
✅ Use `Application` class for K8s resources
❌ Don't use "refactor:" for breaking changes
❌ Don't expose passwords in command line arguments
❌ Avoid `any` type

## Expected Output

### Summary

Brief overview of the changes and alignment with OrangeLab principles.

### 🔴 Critical Issues

- Security risks (exposed secrets, missing `envSecret`)
- Breaking changes labeled incorrectly
- Violation of Single Responsibility or KISS principles
- Linting/Type errors

### 🟡 Important Suggestions

- Code quality improvements (naming, structure)
- Optimization of Pulumi resources
- Missing test coverage
- Improperly tagged resources

### 🟢 Nice to Have

- Minor refactoring for better readability
- Documentation enhancements

### ✅ Good Practices Observed

- Proper use of `Application` class
- Clean TypeScript patterns
- Well-structured Pulumi resources

## Recommendations

- Approval status (Merge/Request Changes)
- Required fixes before merge
- Suggested commit message following conventional commits
