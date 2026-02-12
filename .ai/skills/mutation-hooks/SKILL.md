---
name: mutation-hooks
description: Generate TanStack Query mutation hooks for AEGIRA frontend. Use when creating useMutation hooks for create/update/delete operations, form submissions, or auth actions.
---
# Mutation Hooks (Write Operations)

TanStack Query v5 mutation hooks for AEGIRA. Uses `apiClient` + `ENDPOINTS`, invalidates all affected queries on success.

## File Location & Naming

Mutations share a file with query hooks for the same entity:

```
aegira-frontend/src/features/<feature>/hooks/
├── useTeams.ts              # useTeams + useCreateTeam + useUpdateTeam + useDeleteTeam (grouped)
├── usePersons.ts            # usePersons + useCreatePerson + useUpdatePerson (grouped)
├── useSubmitCheckIn.ts      # Standalone mutation (complex transform)
├── useLogin.ts              # Auth mutation
```

## Mutation Hook Patterns

<!-- @pattern: frontend/mutation-hooks -->

## Checklist

- [ ] Uses `apiClient` from `@/lib/api/client`
- [ ] Uses `ENDPOINTS` constants (dynamic ones are functions)
- [ ] Gets `queryClient` via `useQueryClient()`
- [ ] Invalidates list query after create/update/delete
- [ ] Invalidates detail query after update
- [ ] Invalidates related queries when changes affect other entities
- [ ] Uses `mutateAsync` + try/catch in form submissions (NOT `mutate` with callbacks)
- [ ] Toasts on both success AND error
- [ ] Side effects (toasts, navigation) in page components, not hooks
