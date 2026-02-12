# Pattern System: Complete Sample Walkthrough

> Shows the full lifecycle: pattern file → skill template → resolved skill → generated code

## Table of Contents
1. [How the System Works](#how-the-system-works)
2. [Layer 1: Pattern Files](#layer-1-pattern-files)
3. [Layer 2: Skill Templates](#layer-2-skill-templates)
4. [Layer 3: Resolved Skills](#layer-3-resolved-skills)
5. [Layer 4: Claude Code Uses the Skill](#layer-4-claude-code-uses-the-skill)
6. [Complete Example: "Announcement" Feature](#complete-example-announcement-feature)

---

## How the System Works

```
.ai/patterns/backend/repository-pattern.md     ← SOURCE: coding rules + examples
         ↓
.ai/skills/backend-crud-module/SKILL.md         ← TEMPLATE: <!-- @pattern: backend/repository-pattern -->
         ↓
npm run ai:build  (sync-patterns.js)            ← BUILD: resolves markers
         ↓
.claude/skills/backend-crud-module/SKILL.md     ← OUTPUT: full content injected
         ↓
Claude Code reads .claude/skills/ at runtime    ← USAGE: agent follows the patterns
```

### Key Concepts

| Concept | Location | Who edits | Who reads |
|---------|----------|-----------|-----------|
| Pattern | `.ai/patterns/` | Human | Build script |
| Skill template | `.ai/skills/` | Human | Build script |
| Config | `.ai/sync.config.json` | Human | Build script |
| Resolved skill | `.claude/skills/` | Build script (auto) | Claude Code agent |

---

## Layer 1: Pattern Files

Pattern files are **atomic, reusable** coding rules. Each one covers exactly one topic.

**File:** `.ai/patterns/backend/repository-pattern.md`

```markdown
# Repository Pattern
> Data access layer with BaseRepository for multi-tenant filtering

## When to Use
- Every module that needs database operations
- When enforcing multi-tenant isolation (company_id filtering)

## Canonical Implementation

### Basic Repository Structure
\`\`\`typescript
import type { PrismaClient, Team, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base-repository.js';
import { notFound } from '../../shared/errors.js';

export class TeamRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async findAll(page: number, limit: number) {
    const where = this.where({ is_active: true });
    const [items, total] = await Promise.all([
      this.prisma.team.findMany({ where, skip: (page - 1) * limit, take: limit }),
      this.prisma.team.count({ where }),
    ]);
    return { items, total };
  }
}
\`\`\`

## Rules
- DO extend BaseRepository for all repositories
- DO use this.where() for all queries
- DO use Promise.all for parallel count + findMany
- NEVER query without this.where() (breaks multi-tenancy)
- NEVER use findUnique (doesn't support company_id filtering)

## Common Mistakes
### WRONG: Missing company_id filter
\`\`\`typescript
const items = await this.prisma.team.findMany({ skip, take: limit });
\`\`\`
### CORRECT: Use this.where()
\`\`\`typescript
const items = await this.prisma.team.findMany({ where: this.where({}), skip, take: limit });
\`\`\`
```

---

## Layer 2: Skill Templates

Skill templates use `<!-- @pattern: category/name -->` markers to reference patterns.

**File:** `.ai/skills/backend-crud-module/SKILL.md`

```markdown
---
name: backend-crud-module
description: Generate a complete backend CRUD module for AEGIRA.
---
# Backend CRUD Module

Generate all files for a new feature module.

## Repository Pattern

<!-- @pattern: backend/repository-pattern -->

## Controller Pattern

<!-- @pattern: backend/controller-pattern -->

## Checklist
- [ ] Extends BaseRepository for tenant isolation
- [ ] Uses this.where() for reads
```

The `<!-- @pattern: backend/repository-pattern -->` marker is a **placeholder**. The build script will replace it with the full content of `.ai/patterns/backend/repository-pattern.md`.

---

## Layer 3: Resolved Skills (after `npm run ai:build`)

After running `npm run ai:build`, the marker gets replaced with the actual pattern content.

**File:** `.claude/skills/backend-crud-module/SKILL.md` (auto-generated)

```markdown
---
name: backend-crud-module
description: Generate a complete backend CRUD module for AEGIRA.
---
# Backend CRUD Module

Generate all files for a new feature module.

## Repository Pattern

<!-- BUILT FROM: .ai/patterns/backend/repository-pattern.md -->
# Repository Pattern
> Data access layer with BaseRepository for multi-tenant filtering

## When to Use
- Every module that needs database operations
...
[FULL PATTERN CONTENT INJECTED HERE]
...

## Controller Pattern

<!-- BUILT FROM: .ai/patterns/backend/controller-pattern.md -->
[FULL CONTROLLER PATTERN CONTENT INJECTED HERE]

## Checklist
- [ ] Extends BaseRepository for tenant isolation
- [ ] Uses this.where() for reads
```

**Before build:** skill has `<!-- @pattern: backend/repository-pattern -->` (1 line)
**After build:** skill has the complete pattern content (200+ lines)

---

## Layer 4: Claude Code Uses the Skill

When you open Claude Code and say:

```
Gumawa ka ng backend module para sa announcements
```

Claude Code:

1. **Reads CLAUDE.md** → sees "Feature Creation Workflow" → matches "Create backend module" → `/backend-crud-module`
2. **Invokes `/backend-crud-module`** → reads `.claude/skills/backend-crud-module/SKILL.md`
3. **Skill contains the full patterns** (repository, controller, routes, validator, fire-and-forget)
4. **Generates code** that follows every pattern exactly

The agent doesn't need to search the codebase for examples. The patterns are already embedded in the skill file.

---

## Complete Example: "Announcement" Feature

Below is the exact code that would be generated when you say:
```
Gawan mo ko ng Announcement feature — backend + frontend, full CRUD
```

### Step 1: Database Schema

```prisma
// aegira-backend/prisma/schema.prisma
model Announcement {
  id          String    @id @default(uuid())
  company_id  String
  title       String    @db.VarChar(200)
  content     String    @db.Text
  priority    String    @default("NORMAL") // LOW, NORMAL, HIGH, URGENT
  is_active   Boolean   @default(true)
  published_at DateTime?
  expires_at   DateTime?
  created_by  String
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt

  company Company @relation(fields: [company_id], references: [id])
  author  Person  @relation(fields: [created_by], references: [id])

  @@index([company_id])
  @@index([company_id, is_active])
  @@map("announcements")
}
```

### Step 2: Backend Module (from `/backend-crud-module` pattern)

#### `announcement.validator.ts`

```typescript
// Pattern used: backend/validation-pattern
import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1).trim(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = createAnnouncementSchema.partial();
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export const listAnnouncementsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});
```

#### `announcement.repository.ts`

```typescript
// Pattern used: backend/repository-pattern
import type { PrismaClient, Announcement, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base-repository.js';
import { notFound } from '../../shared/errors.js';

export class AnnouncementRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    priority?: string;
  }): Promise<{ items: Announcement[]; total: number }> {
    const where: Prisma.AnnouncementWhereInput = this.where({
      is_active: true,
      ...(params.priority && { priority: params.priority }),
      ...(params.search && {
        OR: [
          { title: { contains: params.search, mode: 'insensitive' } },
          { content: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    });

    // Pattern: ALWAYS parallel count + findMany
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string): Promise<Announcement> {
    // Pattern: findFirst with this.where(), NEVER findUnique
    const announcement = await this.prisma.announcement.findFirst({
      where: this.where({ id }),
    });

    if (!announcement) {
      throw notFound('Announcement not found');
    }

    return announcement;
  }

  async create(
    data: Omit<Prisma.AnnouncementCreateInput, 'company_id'>
  ): Promise<Announcement> {
    return this.prisma.announcement.create({
      data: {
        ...data,
        company_id: this.companyId, // Pattern: explicit company_id on create
      },
    });
  }

  async update(id: string, data: Prisma.AnnouncementUpdateInput): Promise<Announcement> {
    // Pattern: validate existence before update
    const existing = await this.findById(id);

    return this.prisma.announcement.update({
      where: { id: existing.id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    await this.prisma.announcement.delete({ where: { id: existing.id } });
  }
}
```

#### `announcement.controller.ts`

```typescript
// Pattern used: backend/controller-pattern + backend/fire-and-forget
import type { Context } from 'hono';
import { AnnouncementRepository } from './announcement.repository.js';
import { prisma } from '../../config/database.js';
import { parsePagination } from '../../shared/utils.js';
import { logAudit } from '../../shared/audit.js';

function getRepository(companyId: string): AnnouncementRepository {
  return new AnnouncementRepository(prisma, companyId);
}

export async function listAnnouncements(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const search = c.req.query('search') || undefined;
  const priority = c.req.query('priority') || undefined;

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, search, priority });

  // Pattern: { success: true, data: { items, pagination } }
  return c.json({
    success: true,
    data: {
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    },
  });
}

export async function getAnnouncementById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { id } = c.req.param();

  const repository = getRepository(companyId);
  const announcement = await repository.findById(id);

  return c.json({ success: true, data: announcement });
}

export async function createAnnouncement(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = c.req.valid('json' as never);

  const repository = getRepository(companyId);
  const result = await repository.create({
    title: data.title,
    content: data.content,
    priority: data.priority,
    published_at: data.publishedAt ? new Date(data.publishedAt) : null,
    expires_at: data.expiresAt ? new Date(data.expiresAt) : null,
    created_by: userId,
  });

  // Pattern: fire-and-forget audit (never await)
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_ANNOUNCEMENT',
    entityType: 'ANNOUNCEMENT',
    entityId: result.id,
    details: { title: data.title, priority: data.priority },
  });

  return c.json({ success: true, data: result }, 201);
}

export async function updateAnnouncement(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const { id } = c.req.param();
  const data = c.req.valid('json' as never);

  const repository = getRepository(companyId);
  const result = await repository.update(id, {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.content !== undefined && { content: data.content }),
    ...(data.priority !== undefined && { priority: data.priority }),
    ...(data.publishedAt !== undefined && { published_at: new Date(data.publishedAt) }),
    ...(data.expiresAt !== undefined && { expires_at: new Date(data.expiresAt) }),
  });

  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_ANNOUNCEMENT',
    entityType: 'ANNOUNCEMENT',
    entityId: id,
    details: data,
  });

  return c.json({ success: true, data: result });
}

export async function deleteAnnouncement(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const { id } = c.req.param();

  const repository = getRepository(companyId);
  await repository.delete(id);

  logAudit({
    companyId,
    personId: userId,
    action: 'DELETE_ANNOUNCEMENT',
    entityType: 'ANNOUNCEMENT',
    entityId: id,
  });

  return c.json({ success: true, data: { message: 'Announcement deleted' } });
}
```

#### `announcement.routes.ts`

```typescript
// Pattern used: backend/routes-pattern
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { roleMiddleware } from '../../middleware/role.js';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from './announcement.validator.js';
import * as controller from './announcement.controller.js';

const router = new Hono();

// Pattern: auth + tenant on ALL routes
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

const adminOnly = roleMiddleware(['ADMIN']);

// Pattern: specific routes BEFORE dynamic /:id routes
router.get('/', controller.listAnnouncements);
router.post('/', adminOnly, zValidator('json', createAnnouncementSchema), controller.createAnnouncement);
router.get('/:id', controller.getAnnouncementById);
router.patch('/:id', adminOnly, zValidator('json', updateAnnouncementSchema), controller.updateAnnouncement);
router.delete('/:id', adminOnly, controller.deleteAnnouncement);

export { router as announcementRoutes };
```

#### Register in `app.ts`

```typescript
import { announcementRoutes } from './modules/announcement/announcement.routes.js';

app.route('/announcements', announcementRoutes);
```

### Step 3: Frontend Types

```typescript
// aegira-frontend/src/types/announcement.types.ts
export interface Announcement {
  id: string;
  company_id: string;
  title: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  is_active: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  publishedAt?: string;
  expiresAt?: string;
}

export interface UpdateAnnouncementInput extends Partial<CreateAnnouncementInput> {}
```

### Step 4: Frontend Endpoints

```typescript
// aegira-frontend/src/lib/api/endpoints.ts — add:
ANNOUNCEMENT: {
  LIST: '/announcements',
  BY_ID: (id: string) => `/announcements/${id}`,
  CREATE: '/announcements',
  UPDATE: (id: string) => `/announcements/${id}`,
  DELETE: (id: string) => `/announcements/${id}`,
},
```

### Step 5: Query Hook (from `/query-hooks` pattern)

```typescript
// aegira-frontend/src/features/admin/hooks/useAnnouncements.ts
// Pattern used: frontend/query-hooks
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type { Announcement } from '@/types/announcement.types';

export type { Announcement };

export function useAnnouncements(page = 1, limit = 20, search = '') {
  return useQuery({
    // Pattern: ALL params in queryKey
    queryKey: ['announcements', page, limit, search],
    // Pattern: use STALE_TIMES constant
    staleTime: STALE_TIMES.STANDARD,
    // Pattern: keepPreviousData for pagination
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // Pattern: URLSearchParams, not string concat
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      return apiClient.get<PaginatedResponse<Announcement>>(
        `${ENDPOINTS.ANNOUNCEMENT.LIST}?${params.toString()}`
      );
    },
  });
}

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: ['announcement', id],
    staleTime: STALE_TIMES.STANDARD,
    // Pattern: enabled guard for dynamic ID
    enabled: !!id,
    queryFn: () => apiClient.get<Announcement>(ENDPOINTS.ANNOUNCEMENT.BY_ID(id)),
  });
}
```

### Step 6: Mutation Hooks (from `/mutation-hooks` pattern)

```typescript
// aegira-frontend/src/features/admin/hooks/useAnnouncementMutations.ts
// Pattern used: frontend/mutation-hooks
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from '@/types/announcement.types';

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAnnouncementInput) =>
      apiClient.post(ENDPOINTS.ANNOUNCEMENT.CREATE, data),
    onSuccess: () => {
      // Pattern: invalidate list query
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAnnouncementInput }) =>
      apiClient.patch(ENDPOINTS.ANNOUNCEMENT.UPDATE(id), data),
    onSuccess: (_, { id }) => {
      // Pattern: invalidate list AND detail
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement', id] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(ENDPOINTS.ANNOUNCEMENT.DELETE(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}
```

### Step 7: List Page (from `/data-table-page` pattern)

```typescript
// aegira-frontend/src/features/admin/pages/AdminAnnouncementsPage.tsx
// Pattern used: frontend/data-table-pattern
import { useState } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { TableSearch } from '@/components/common/TableSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes.config';
import { useAnnouncements, type Announcement } from '../hooks/useAnnouncements';
import { formatDate } from '@/lib/utils/date.utils';

// Pattern: columns OUTSIDE the component
const columns: ColumnDef<Announcement>[] = [
  { accessorKey: 'title', header: 'Title' },
  {
    accessorKey: 'priority',
    header: 'Priority',
    cell: ({ row }) => {
      const priority = row.original.priority;
      const variant = {
        LOW: 'secondary',
        NORMAL: 'default',
        HIGH: 'warning',
        URGENT: 'destructive',
      }[priority] as 'secondary' | 'default' | 'warning' | 'destructive';
      return <Badge variant={variant}>{priority}</Badge>;
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => formatDate(row.original.created_at),
  },
];

export default function AdminAnnouncementsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  // Pattern: pageIndex 0-indexed, API 1-indexed
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, error } = useAnnouncements(
    pagination.pageIndex + 1, // Pattern: +1 for API
    pagination.pageSize,
    search
  );

  return (
    // Pattern: PageLoader wraps everything
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <PageHeader
        title="Announcements"
        action={
          <Button onClick={() => navigate(ROUTES.ADMIN_ANNOUNCEMENTS_CREATE)}>
            Create Announcement
          </Button>
        }
      />
      {/* Pattern: TableSearch from common components */}
      <TableSearch value={search} onChange={setSearch} placeholder="Search announcements..." />
      <DataTable
        columns={columns}
        data={data?.items ?? []} // Pattern: ?? [] never undefined
        pageCount={data?.pagination?.totalPages}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    </PageLoader>
  );
}
```

### Step 8: Routes & Navigation

```typescript
// aegira-frontend/src/config/routes.config.ts — add:
ADMIN_ANNOUNCEMENTS: '/admin/announcements',
ADMIN_ANNOUNCEMENTS_CREATE: '/admin/announcements/create',
ADMIN_ANNOUNCEMENTS_EDIT: '/admin/announcements/:id/edit',

// aegira-frontend/src/routes/index.tsx — add:
const AdminAnnouncementsPage = lazy(() => import('@/features/admin/pages/AdminAnnouncementsPage'));
const AdminAnnouncementCreatePage = lazy(() => import('@/features/admin/pages/AdminAnnouncementCreatePage'));
const AdminAnnouncementEditPage = lazy(() => import('@/features/admin/pages/AdminAnnouncementEditPage'));

// Inside ADMIN RouteGuard:
<Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
<Route path="/admin/announcements/create" element={<AdminAnnouncementCreatePage />} />
<Route path="/admin/announcements/:id/edit" element={<AdminAnnouncementEditPage />} />
```

---

## Pattern Traceability

Every line of generated code maps back to a pattern:

| Code Pattern | Source Pattern File | Rule |
|---|---|---|
| `extends BaseRepository` | `backend/repository-pattern` | Multi-tenant isolation |
| `this.where({ ... })` | `backend/repository-pattern` | company_id filtering |
| `Promise.all([findMany, count])` | `backend/repository-pattern` | Parallel queries |
| `throw notFound()` | `backend/error-handling` | AppError not raw Error |
| `logAudit({ ... })` (no await) | `backend/fire-and-forget` | Non-blocking audit |
| `{ success: true, data }` | `shared/response-format` | Standard response |
| `zValidator('json', schema)` | `backend/validation-pattern` | Zod in routes |
| `queryKey: ['x', page, limit, search]` | `frontend/query-hooks` | All params in key |
| `STALE_TIMES.STANDARD` | `frontend/query-hooks` | Named constant |
| `keepPreviousData` | `frontend/query-hooks` | Smooth pagination |
| `data?.items ?? []` | `frontend/data-table-pattern` | Never undefined |
| `pagination.pageIndex + 1` | `frontend/data-table-pattern` | 0-indexed → 1-indexed |
| `columns` outside component | `frontend/data-table-pattern` | Prevent re-renders |
| `PageLoader` wrapper | `ui/component-usage` | Loading/error states |
| `TableSearch` component | `ui/component-usage` | Reusable search |

---

## Summary: What Happens When You Ask Claude Code

```
User: "Gawan mo ko ng Announcement feature"
                    ↓
CLAUDE.md: Feature Creation Workflow
  → Matches "Create backend module" → /backend-crud-module
  → Matches "Create list page" → /data-table-page
  → etc.
                    ↓
Claude invokes /backend-crud-module
  → Reads .claude/skills/backend-crud-module/SKILL.md
  → SKILL.md contains FULL patterns (resolved by build)
  → Generates code following every pattern
                    ↓
Claude invokes /query-hooks, /mutation-hooks, /data-table-page
  → Same process: reads resolved skill → generates matching code
                    ↓
Result: All generated code follows established patterns
        No manual pattern lookup needed
        Consistent across all sessions
```
