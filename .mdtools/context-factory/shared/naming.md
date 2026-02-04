---
description: Naming Conventions for AEGIRA (All Layers)
globs: ["**/*"]
alwaysApply: true
---
# Naming Conventions

## Universal Table

| Element                 | Convention             | Example               |
| ----------------------- | ---------------------- | --------------------- |
| Files/Folders           | `kebab-case`           | `user-profile.ts`     |
| Feature Domains         | `_kebab-case`          | `_user-management/`   |
| Route Domains           | `-kebab-case`          | `-dashboard/`         |
| Types/Classes           | `PascalCase`           | `UserProfile`         |
| Functions/Variables     | `camelCase`            | `getUserProfile`      |
| Zod Schemas             | `camelCase`            | `userProfileSchema`   |
| Database Tables/Columns | `snake_case`           | `user_profile`        |
| API Request/Response    | `snake_case`           | `{ user_id: 123 }`   |
| Error Codes             | `SCREAMING_SNAKE_CASE` | `NOT_FOUND`           |

## Backend File Naming

```
<feature>.routes.ts        → check-in.routes.ts
<feature>.controller.ts    → check-in.controller.ts
<feature>.service.ts       → check-in.service.ts
<feature>.repository.ts    → check-in.repository.ts
<feature>.validator.ts     → check-in.validator.ts
```

## Frontend File Naming

```
Components:   PascalCase.tsx            → CheckInForm.tsx
Hooks:        use<Name>.ts             → useCheckIns.ts, useSubmitCheckIn.ts
Utilities:    camelCase.ts             → formatDate.ts
Types:        kebab-case.types.ts      → check-in.types.ts
Pages:        PascalCase + Page.tsx    → CheckInPage.tsx
Stores:       camelCase.store.ts       → auth.store.ts
Config:       camelCase.config.ts      → api.config.ts
```

## Frontend Hook File Naming

Hooks use **camelCase** file names (matching the function name). Multiple related hooks can live in a single file.

```
use<Entity>s.ts                → usePersons.ts       (CRUD hooks for persons)
use<Entity>.ts                 → useCheckIn.ts        (single entity hook)
useSubmit<Entity>.ts           → useSubmitCheckIn.ts   (submit/create action)
use<Entity>History.ts          → useCheckInHistory.ts  (paginated history)
use<Entity>Status.ts           → useCheckInStatus.ts   (status query)
useToday<Entity>.ts            → useTodayCheckIn.ts    (today's data)
useDashboardStats.ts           → useDashboardStats.ts  (aggregated stats)
```

## Frontend Hook Function Naming

```
use<Entity>s                    → usePersons          (list/CRUD)
useCreate<Entity>               → useCreatePerson     (create mutation)
useUpdate<Entity>               → useUpdatePerson     (update mutation)
useDelete<Entity>               → useDeletePerson     (delete mutation)
useSubmit<Entity>               → useSubmitCheckIn    (submit action)
use<Entity>History              → useCheckInHistory   (paginated read)
use<Entity>Status               → useCheckInStatus    (status read)
useDashboardStats               → useDashboardStats   (aggregate read)
```

## Backend Type Naming

```
[Entity]                         → Person
Create[Entity]Input              → CreatePersonInput
Update[Entity]Input              → UpdatePersonInput
Submit[Entity]Input              → SubmitCheckInInput
```

## Frontend Type Naming

Frontend types use camelCase fields (transformed from backend snake_case):

```
[Entity]                         → Person, CheckIn
Backend[Entity]                  → BackendCheckIn        (raw API response, snake_case)
[Entity]Submission               → CheckInSubmission     (frontend form data)
PaginatedResponse<T>             → PaginatedResponse<Person>
```

## Data Transformation

Backend returns `snake_case`, frontend uses `camelCase`. Hooks transform at the boundary:

```
Backend: { hours_slept, stress_level, check_in_date }
Frontend: { hoursSlept, stressLevel, checkInDate }
```
