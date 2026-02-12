---
name: query-hooks
description: Generate TanStack Query read hooks for AEGIRA frontend. Use when creating useQuery hooks for data fetching, working with hooks/ directories, or implementing paginated list queries.
---
# Query Hooks (Read Operations)

TanStack Query v5 read hooks for AEGIRA. Uses `apiClient` + `ENDPOINTS` constants + `STALE_TIMES` config.

## File Location & Naming

```
aegira-frontend/src/features/<feature>/hooks/
├── usePersons.ts           # Paginated list + mutations (grouped per entity)
├── useCheckInHistory.ts    # Paginated history
├── useCheckInStatus.ts     # Single status
├── useTodayCheckIn.ts      # Today's data
├── useDashboardStats.ts    # Aggregated data
```

Filenames use **camelCase** (not kebab-case).

## Query Hook Patterns

<!-- @pattern: frontend/query-hooks -->

## Response Format Reference

<!-- @pattern: shared/response-format -->

## Stale Time Decision Tree

<!-- @pattern: shared/decision-trees -->

## Checklist

- [ ] queryKey includes ALL params that affect the response
- [ ] Used `STALE_TIMES` constant (not magic numbers)
- [ ] Used `ENDPOINTS` constant (not hardcoded URLs)
- [ ] Added `enabled: !!id` guard for dynamic IDs
- [ ] Built query params with `URLSearchParams`
- [ ] Re-exported types from hooks for consumer convenience
- [ ] Used `refetchInterval` for polling data
- [ ] Used `refetchOnWindowFocus: true` for dashboards
