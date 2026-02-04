---
description: AEGIRA V5 Context Factory - Master Index
alwaysApply: true
---
# AEGIRA V5 Context Factory

Central knowledge base for AI-assisted development. Each file defines the **canonical pattern** for a specific concern. When generating or reviewing code, reference the relevant context file.

## Structure

```
.mdtools/context-factory/
├── _index.md                            # This file
├── architecture/
│   ├── event-sourcing.md                  # Event sourcing
│   ├── multi-tenant.md                    # Multi-tenant isolation
│   └── tech-stack.md                      # Tech stack & architecture
├── backend/
│   ├── controllers.md                     # Write a controller
│   ├── error-handling.md                  # Handle errors
│   ├── middleware.md                      # Add middleware
│   ├── module-structure.md                # Create a module
│   ├── repositories.md                    # Write a repository
│   ├── routes.md                          # Add routes
│   ├── services.md                        # Write a service
│   └── validators.md                      # Write validators
├── frontend/
│   ├── api-client.md                      # API client
│   ├── components.md                      # Components
│   ├── data-table.md                      # DataTable pages
│   ├── feature-structure.md               # Feature structure
│   ├── forms.md                           # Forms
│   ├── mutation-hooks.md                  # Mutation hooks
│   ├── page-patterns.md                   # Page layouts
│   ├── query-hooks.md                     # Query hooks
│   └── state-management.md                # State management
└── shared/
    ├── api-contract.md                    # API contract
    ├── naming.md                          # Naming conventions
    ├── security.md                        # Security
    ├── time-handling.md                   # Timezone handling
    └── typescript.md                      # TypeScript rules
```

## How to Use

1. **Before writing code** - Read the relevant context file for the layer you're working in.
2. **When generating** - Follow the exact patterns, naming, and file structure defined.
3. **When reviewing** - Check code against the rules in the applicable context files.
4. **When in doubt** - The context file is the single source of truth.

## Quick Lookup

| I need to...                    | Read this file                          |
| ------------------------------- | --------------------------------------- |
| Create a module                 | `backend/module-structure.md`             |
| Add routes                      | `backend/routes.md`                       |
| Write a controller              | `backend/controllers.md`                  |
| Write a service                 | `backend/services.md`                     |
| Write a repository              | `backend/repositories.md`                 |
| Write validators                | `backend/validators.md`                   |
| Handle errors                   | `backend/error-handling.md`               |
| Add middleware                  | `backend/middleware.md`                   |
| Feature structure               | `frontend/feature-structure.md`           |
| API client                      | `frontend/api-client.md`                  |
| Query hooks                     | `frontend/query-hooks.md`                 |
| Mutation hooks                  | `frontend/mutation-hooks.md`              |
| Components                      | `frontend/components.md`                  |
| Forms                           | `frontend/forms.md`                       |
| State management                | `frontend/state-management.md`            |
| DataTable pages                 | `frontend/data-table.md`                  |
| Page layouts                    | `frontend/page-patterns.md`               |
| Tech stack & architecture       | `architecture/tech-stack.md`              |
| Multi-tenant isolation          | `architecture/multi-tenant.md`            |
| Event sourcing                  | `architecture/event-sourcing.md`          |
| Naming conventions              | `shared/naming.md`                        |
| TypeScript rules                | `shared/typescript.md`                    |
| Security                        | `shared/security.md`                      |
| API contract                    | `shared/api-contract.md`                  |
| Timezone handling               | `shared/time-handling.md`                 |
