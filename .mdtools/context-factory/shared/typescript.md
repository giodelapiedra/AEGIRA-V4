---
description: TypeScript Rules for AEGIRA (Both Frontend and Backend)
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
---
# TypeScript Rules

Applies to both `aegira-backend/` and `aegira-frontend/`. Strict mode is enabled everywhere.

## Core Rules

1. **Strict mode always enabled** - `"strict": true` in tsconfig
2. **NO `any` types** - use `unknown` if the type is truly unknown
3. **Explicit return types** on all exported functions
4. **Interface for objects, type for unions/primitives**

## Type Definitions

```typescript
// Interface for object shapes
interface Person {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

// Type for unions, primitives, derived types
type Role = 'ADMIN' | 'SUPERVISOR' | 'TEAM_LEAD' | 'WORKER';
type ReadinessLevel = 'GREEN' | 'YELLOW' | 'RED';
type PersonOrNull = Person | null;

// Inferred types from Zod (preferred for form/validation types)
type CreatePersonInput = z.infer<typeof createPersonSchema>;
```

## Function Signatures

```typescript
// Exported functions MUST have explicit return types
export async function getPersonById(id: string): Promise<Person | null> {
  return prisma.person.findFirst({ where: { id } });
}

// Internal functions can use inference
function formatName(first: string, last: string) {
  return `${first} ${last}`;
}
```

## Props Interfaces

```typescript
// ALWAYS define explicit prop interfaces for React components
interface CheckInFormProps {
  onSubmit: (data: CheckInFormData) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<CheckInFormData>;
}

export function CheckInForm({ onSubmit, isSubmitting, defaultValues }: CheckInFormProps) {
  // ...
}
```

## Forbidden Patterns

```typescript
// NEVER use 'any'
const data: any = {};              // BAD
const data: unknown = {};          // OK if truly unknown

// NEVER use non-null assertion without checking
const user = c.get('user')!;      // BAD
const user = c.get('user') as AuthenticatedUser;  // OK (after auth middleware)

// NEVER use @ts-ignore
// @ts-ignore                      // BAD
// @ts-expect-error - reason       // OK if genuinely needed with explanation
```

## Code Quality

- Keep functions small (max 50 lines)
- Single responsibility per function
- Descriptive names (no abbreviations)
- Comments for "why", not "what"
