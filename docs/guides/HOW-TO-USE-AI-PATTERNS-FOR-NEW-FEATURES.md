# Paano Gamitin ang .ai Directory Kapag Nagdadagdag ng Bagong Feature

> Complete guide kung paano gamitin ang pattern system ng AEGIRA kapag nagdadagdag ng bagong feature, at kung paano idodokumento ito.

## Table of Contents
1. [Overview: Ano ang .ai Directory?](#overview-ano-ang-ai-directory)
2. [Workflow: Step-by-Step](#workflow-step-by-step)
3. [Documentation: Paano Mag-document](#documentation-paano-mag-document)
4. [Complete Example: "Announcement" Feature](#complete-example-announcement-feature)
5. [Real-World Scenario: Calendar Feature](#real-world-scenario-calendar-feature) - **NEW** Complete walkthrough example
6. [Command Prompt Examples](#command-prompt-examples) - Practical command samples
7. [FAQ](#faq)

---

## Overview: Ano ang .ai Directory?

Ang `.ai` directory ay ang **source of truth** para sa lahat ng coding patterns ng AEGIRA. Ito ay may tatlong main components:

```
.ai/
├── patterns/          ← Atomic coding patterns (25+ files)
│   ├── backend/      ← Backend patterns (8 files)
│   ├── frontend/     ← Frontend patterns (8 files)
│   ├── ui/           ← UI patterns (4 files)
│   └── shared/       ← Cross-cutting patterns (5 files)
├── skills/           ← Skill templates (9 skills)
│   ├── backend-crud-module/
│   ├── query-hooks/
│   ├── data-table-page/
│   └── ...
├── rules/            ← Rule templates (3 rules)
└── sync.config.json  ← Pattern → skill mapping
```

### Paano Gumagana?

1. **Patterns** (`.ai/patterns/`) - Atomic coding rules na reusable
2. **Skills** (`.ai/skills/`) - Templates na nagre-reference sa patterns via `<!-- @pattern: ... -->`
3. **Build Process** (`npm run ai:build`) - Resolves markers at generates `.claude/skills/` at `.cursor/skills/`
4. **AI Agent** - Reads `.claude/skills/` at generates code following patterns

### Key Concept: Pattern → Skill → Code

```
.ai/patterns/backend/repository-pattern.md     ← SOURCE: coding rules
         ↓
.ai/skills/backend-crud-module/SKILL.md        ← TEMPLATE: <!-- @pattern: backend/repository-pattern -->
         ↓
npm run ai:build                                ← BUILD: resolves markers
         ↓
.claude/skills/backend-crud-module/SKILL.md    ← OUTPUT: full content injected
         ↓
Claude Code reads .claude/skills/              ← USAGE: generates code following patterns
```

---

## Quick Start: Paano Gamitin?

### Para sa Complete Example (Recommended)

**Kung gusto mo ng complete walkthrough**, jump to:
👉 **[Real-World Scenario: Calendar Feature](#real-world-scenario-calendar-feature)**

Ito ay complete example kung paano mo sasabihin kay Claude Code na gumawa ng feature, at kung paano niya gagawin following patterns.

### Para sa Step-by-Step Guide

**Kung gusto mo ng detailed steps**, follow:
👉 **[Workflow: Step-by-Step](#workflow-step-by-step)**

### Para sa Command Examples

**Kung gusto mo ng command samples**, see:
👉 **[Command Prompt Examples](#command-prompt-examples)**

---

## Workflow: Step-by-Step

### Scenario: Magdadagdag ka ng bagong feature na "Announcements"

### Step 1: Plan Your Feature

**Questions to answer:**
- Ano ang purpose ng feature?
- Ano ang database fields needed?
- Sino ang may access (roles)?
- Ano ang frontend pages needed (list, create, edit)?

**Example:**
```
Feature: Announcements
- Admin can create announcements
- All users can view announcements
- Fields: title, content, priority, published_at, expires_at
- Pages: List, Create, Edit
```

### Step 2: Database Schema First

**Edit:** `aegira-backend/prisma/schema.prisma`

```prisma
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

**Run migration:**
```bash
cd aegira-backend
npm run db:migrate -- --name add_announcements
```

### Step 3: Backend Module (Using Skills)

**Use the skill:**
```
/backend-crud-module announcements
```

**What happens:**
1. Claude Code reads `.claude/skills/backend-crud-module/SKILL.md`
2. Skill contains full patterns (repository, controller, routes, validator)
3. Generates code following all patterns

**Generated files:**
```
aegira-backend/src/modules/announcement/
├── announcement.routes.ts      # Route definitions + middleware
├── announcement.controller.ts # Request handling + response formatting
├── announcement.repository.ts  # Database operations (extends BaseRepository)
└── announcement.validator.ts  # Zod schemas + type exports
```

**Patterns automatically applied:**
- ✅ Multi-tenant isolation (`BaseRepository.where()`)
- ✅ Standard response format (`{ success: true, data }`)
- ✅ Fire-and-forget audit logs
- ✅ Zod validation
- ✅ Error handling

**Register routes:**
```typescript
// aegira-backend/src/app.ts
import { announcementRoutes } from './modules/announcement/announcement.routes.js';

app.route('/announcements', announcementRoutes);
```

### Step 4: Frontend Types

**Create:** `aegira-frontend/src/types/announcement.types.ts`

```typescript
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

### Step 5: Frontend Endpoints

**Edit:** `aegira-frontend/src/lib/api/endpoints.ts`

```typescript
export const ENDPOINTS = {
  // ... existing endpoints
  ANNOUNCEMENT: {
    LIST: '/announcements',
    BY_ID: (id: string) => `/announcements/${id}`,
    CREATE: '/announcements',
    UPDATE: (id: string) => `/announcements/${id}`,
    DELETE: (id: string) => `/announcements/${id}`,
  },
} as const;
```

### Step 6: Frontend Query Hooks

**Use the skill:**
```
/query-hooks announcements
```

**Generated:** `aegira-frontend/src/features/admin/hooks/useAnnouncements.ts`

**Patterns automatically applied:**
- ✅ `queryKey` includes all params
- ✅ `STALE_TIMES` constants
- ✅ `keepPreviousData` for pagination
- ✅ Proper error handling

### Step 7: Frontend Mutation Hooks

**Use the skill:**
```
/mutation-hooks announcements
```

**Added to:** Same hooks file (`useAnnouncements.ts`)

**Patterns automatically applied:**
- ✅ Query invalidation on success
- ✅ Proper error handling
- ✅ TypeScript types

### Step 8: Frontend List Page

**Use the skill:**
```
/data-table-page announcements
```

**Generated:** `aegira-frontend/src/features/admin/pages/AdminAnnouncementsPage.tsx`

**Patterns automatically applied:**
- ✅ DataTable with server-side pagination
- ✅ Search functionality
- ✅ `PageLoader` wrapper
- ✅ Columns defined outside component
- ✅ Proper pagination state handling

### Step 9: Frontend Form Pages

**Use the skill:**
```
/form-component announcements create
/form-component announcements edit
```

**Generated:**
- `AdminAnnouncementCreatePage.tsx`
- `AdminAnnouncementEditPage.tsx`

**Patterns automatically applied:**
- ✅ React Hook Form + Zod validation
- ✅ Proper form state management
- ✅ Toast notifications
- ✅ Navigation after success

### Step 10: Add Routes

**Edit:** `aegira-frontend/src/config/routes.config.ts`

```typescript
export const ROUTES = {
  // ... existing routes
  ADMIN_ANNOUNCEMENTS: '/admin/announcements',
  ADMIN_ANNOUNCEMENTS_CREATE: '/admin/announcements/create',
  ADMIN_ANNOUNCEMENTS_EDIT: '/admin/announcements/:id/edit',
} as const;
```

**Edit:** `aegira-frontend/src/routes/index.tsx`

```typescript
// Lazy imports
const AdminAnnouncementsPage = lazy(() => import('@/features/admin/pages/AdminAnnouncementsPage'));
const AdminAnnouncementCreatePage = lazy(() => import('@/features/admin/pages/AdminAnnouncementCreatePage'));
const AdminAnnouncementEditPage = lazy(() => import('@/features/admin/pages/AdminAnnouncementEditPage'));

// Routes
<Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
  <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
  <Route path="/admin/announcements/create" element={<AdminAnnouncementCreatePage />} />
  <Route path="/admin/announcements/:id/edit" element={<AdminAnnouncementEditPage />} />
</Route>
```

### Step 11: Add to Navigation (Optional)

**Edit:** `aegira-frontend/src/components/layout/Sidebar.tsx`

Add menu item if needed.

---

## Documentation: Paano Mag-document

### Option 1: Feature-Specific Documentation

**Create:** `docs/features/announcements/README.md`

```markdown
# Announcements Feature

## Overview
Admin can create and manage company-wide announcements. All users can view active announcements.

## Database Schema
[Link to Prisma schema or copy relevant model]

## API Endpoints
- `GET /announcements` - List announcements (paginated)
- `GET /announcements/:id` - Get single announcement
- `POST /announcements` - Create announcement (ADMIN only)
- `PATCH /announcements/:id` - Update announcement (ADMIN only)
- `DELETE /announcements/:id` - Delete announcement (ADMIN only)

## Frontend Pages
- `/admin/announcements` - List page
- `/admin/announcements/create` - Create page
- `/admin/announcements/:id/edit` - Edit page

## Business Rules
- Only ADMIN can create/edit/delete announcements
- All authenticated users can view announcements
- Announcements can have expiration dates
- Priority levels: LOW, NORMAL, HIGH, URGENT

## Related Features
- [Notifications](./notifications.md) - Users get notified of new announcements
```

### Option 2: Update Main Guides

**If your feature introduces new patterns:**

1. **Check if pattern exists:**
   ```bash
   ls .ai/patterns/backend/
   ls .ai/patterns/frontend/
   ```

2. **If pattern doesn't exist, add it:**
   ```bash
   # Create new pattern file
   code .ai/patterns/backend/new-pattern.md
   ```

3. **Update skill if needed:**
   ```bash
   # Edit skill template
   code .ai/skills/backend-crud-module/SKILL.md
   # Add: <!-- @pattern: backend/new-pattern -->
   ```

4. **Update sync config:**
   ```bash
   code .ai/sync.config.json
   # Add pattern to skill's "patterns" array
   ```

5. **Rebuild:**
   ```bash
   npm run ai:build
   npm run ai:validate
   ```

6. **Document the new pattern:**
   ```bash
   # Add to guides
   code docs/guides/HOW-TO-ADD-NEW-FEATURE.md
   # Add example or reference
   ```

### Option 3: Update Existing Guides

**If your feature follows existing patterns:**

1. **Add example to:** `docs/guides/HOW-TO-ADD-NEW-FEATURE.md`
   - Add your feature as a complete example
   - Show step-by-step process

2. **Add to:** `docs/guides/PATTERN-SYSTEM-SAMPLE.md`
   - Show how patterns were applied
   - Trace pattern → code mapping

### Documentation Checklist

- [ ] Feature overview (what it does, who uses it)
- [ ] Database schema (Prisma model)
- [ ] API endpoints (routes, methods, roles)
- [ ] Frontend pages (routes, components)
- [ ] Business rules (validation, permissions)
- [ ] Related features (dependencies, integrations)
- [ ] Screenshots/mockups (if UI-heavy feature)
- [ ] Testing notes (how to test manually)

---

## Complete Example: "Announcement" Feature

### Quick Checklist

```
Feature: Announcements
- [x] Database schema added
- [x] Backend module generated (/backend-crud-module)
- [x] Routes registered in app.ts
- [x] Frontend types created
- [x] Endpoints added
- [x] Query hooks generated (/query-hooks)
- [x] Mutation hooks generated (/mutation-hooks)
- [x] List page generated (/data-table-page)
- [x] Form pages generated (/form-component)
- [x] Routes added to routes.config.ts
- [x] Routes registered in routes/index.tsx
- [x] Navigation updated (if needed)
- [x] Documentation created
```

### Documentation Created

**File:** `docs/features/announcements/README.md`

```markdown
# Announcements Feature

## Overview
Admin can create and manage company-wide announcements. All authenticated users can view active announcements.

## Database Schema

```prisma
model Announcement {
  id          String    @id @default(uuid())
  company_id  String
  title       String    @db.VarChar(200)
  content     String    @db.Text
  priority    String    @default("NORMAL")
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

## API Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/announcements` | All | List announcements (paginated) |
| GET | `/announcements/:id` | All | Get single announcement |
| POST | `/announcements` | ADMIN | Create announcement |
| PATCH | `/announcements/:id` | ADMIN | Update announcement |
| DELETE | `/announcements/:id` | ADMIN | Delete announcement |

## Frontend Pages

- `/admin/announcements` - List page with search and pagination
- `/admin/announcements/create` - Create new announcement
- `/admin/announcements/:id/edit` - Edit existing announcement

## Business Rules

1. **Access Control:**
   - ADMIN: Full CRUD access
   - All authenticated users: Read-only access

2. **Priority Levels:**
   - LOW: Informational
   - NORMAL: Standard (default)
   - HIGH: Important
   - URGENT: Critical

3. **Publishing:**
   - Announcements can have `published_at` date
   - Announcements can have `expires_at` date
   - Only active announcements are shown to users

## Related Features

- **Notifications** - Users receive notifications when new announcements are created
- **Dashboard** - Announcements widget shows recent announcements

## Testing

### Manual Testing

1. **Create Announcement:**
   - Login as ADMIN
   - Navigate to `/admin/announcements`
   - Click "Create Announcement"
   - Fill form and submit
   - Verify announcement appears in list

2. **View Announcements:**
   - Login as any user
   - Navigate to `/admin/announcements`
   - Verify list shows active announcements
   - Verify search works

3. **Edit Announcement:**
   - Login as ADMIN
   - Click edit on an announcement
   - Modify fields and save
   - Verify changes reflected

4. **Delete Announcement:**
   - Login as ADMIN
   - Click delete on an announcement
   - Confirm deletion
   - Verify announcement removed from list
```

---

## Real-World Scenario: Calendar Feature

### Scenario: "Gusto ko ng Calendar feature sa system ko"

Ito ay complete walkthrough kung paano mo sasabihin kay Claude Code na gumawa ng Calendar feature, at kung paano niya gagawin following patterns.

### Step 1: Sabihin mo kay Claude Code

**Message sa Claude Code:**

```
Gumawa ka ng Calendar feature para sa system ko. Requirements:

1. Database:
   - CalendarEvent model
   - Fields: title, description, start_date, end_date, event_type, location, is_all_day
   - Multi-tenant (company_id)
   - May relation sa Person (created_by)

2. Backend:
   - Full CRUD API
   - List events by date range
   - Filter by event_type
   - ADMIN at WHS: full access
   - Others: read-only

3. Frontend:
   - Calendar view (monthly view with events)
   - List page (paginated)
   - Create/Edit forms
   - Event types: MEETING, TRAINING, HOLIDAY, OTHER

Sundin mo yung patterns sa codebase. Gamitin mo yung skills.
```

### Step 2: Ano ang Gagawin ni Claude Code

#### A. Database Schema

**Claude Code will:**
1. Edit `aegira-backend/prisma/schema.prisma`
2. Add CalendarEvent model following existing patterns

**Generated Schema:**

```prisma
model CalendarEvent {
  id          String    @id @default(uuid())
  company_id  String
  title       String    @db.VarChar(200)
  description String?   @db.Text
  start_date  DateTime
  end_date    DateTime
  event_type  String    @default("OTHER") // MEETING, TRAINING, HOLIDAY, OTHER
  location    String?
  is_all_day  Boolean   @default(false)
  is_active   Boolean   @default(true)
  created_by  String
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt

  company Company @relation(fields: [company_id], references: [id])
  author  Person  @relation(fields: [created_by], references: [id])

  @@index([company_id])
  @@index([company_id, start_date])
  @@index([company_id, event_type])
  @@map("calendar_events")
}
```

**Then Claude Code will run:**
```bash
cd aegira-backend
npm run db:migrate -- --name add_calendar_events
```

#### B. Backend Module

**Claude Code will use skill:**

```
/backend-crud-module calendar-event

Feature: calendar-event
Model fields:
- title: string (required, max 200)
- description: string (optional, text)
- start_date: DateTime (required)
- end_date: DateTime (required)
- event_type: enum (MEETING, TRAINING, HOLIDAY, OTHER, default OTHER)
- location: string (optional, max 200)
- is_all_day: boolean (default false)

Additional endpoints:
- GET /calendar-events?startDate=2025-02-01&endDate=2025-02-28 (date range filter)

Roles:
- ADMIN, WHS: full CRUD access
- Others: read-only access
```

**Generated Files:**

1. **`calendar-event.validator.ts`** - Zod schemas
2. **`calendar-event.repository.ts`** - Database operations (extends BaseRepository)
3. **`calendar-event.controller.ts`** - Request handlers
4. **`calendar-event.routes.ts`** - Route definitions

**Key Pattern Followed:**
- ✅ Multi-tenant isolation (`BaseRepository.where()`)
- ✅ Standard response format
- ✅ Fire-and-forget audit logs
- ✅ Zod validation
- ✅ Date range filtering

**Then Claude Code will:**
- Register routes in `aegira-backend/src/app.ts`
- Add date range query support in repository

#### C. Frontend Types

**Claude Code will create:**

`aegira-frontend/src/types/calendar-event.types.ts`

```typescript
export interface CalendarEvent {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  event_type: 'MEETING' | 'TRAINING' | 'HOLIDAY' | 'OTHER';
  location: string | null;
  is_all_day: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  eventType: 'MEETING' | 'TRAINING' | 'HOLIDAY' | 'OTHER';
  location?: string;
  isAllDay?: boolean;
}

export interface UpdateCalendarEventInput extends Partial<CreateCalendarEventInput> {}

export interface CalendarEventListParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  search?: string;
}
```

#### D. Frontend Endpoints

**Claude Code will edit:**

`aegira-frontend/src/lib/api/endpoints.ts`

```typescript
export const ENDPOINTS = {
  // ... existing endpoints
  CALENDAR_EVENT: {
    LIST: '/calendar-events',
    BY_ID: (id: string) => `/calendar-events/${id}`,
    CREATE: '/calendar-events',
    UPDATE: (id: string) => `/calendar-events/${id}`,
    DELETE: (id: string) => `/calendar-events/${id}`,
  },
} as const;
```

#### E. Frontend Query Hooks

**Claude Code will use skill:**

```
/query-hooks calendar-event

Feature: calendar-event
Hooks needed:
- useCalendarEvents (paginated list with filters: startDate, endDate, eventType, search)
- useCalendarEvent (single by ID)
- useCalendarEventsByDateRange (for calendar view, no pagination)
```

**Generated:**

`aegira-frontend/src/features/calendar/hooks/useCalendarEvents.ts`

```typescript
export function useCalendarEvents(params: CalendarEventListParams = {}) {
  return useQuery({
    queryKey: ['calendar-events', params.page, params.limit, params.startDate, params.endDate, params.eventType, params.search],
    staleTime: STALE_TIMES.SHORT, // Calendar data changes frequently
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      if (params.eventType) searchParams.set('eventType', params.eventType);
      if (params.search) searchParams.set('search', params.search);
      
      return apiClient.get<PaginatedResponse<CalendarEvent>>(
        `${ENDPOINTS.CALENDAR_EVENT.LIST}?${searchParams.toString()}`
      );
    },
  });
}

export function useCalendarEventsByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['calendar-events', 'date-range', startDate, endDate],
    staleTime: STALE_TIMES.SHORT,
    enabled: !!startDate && !!endDate,
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      return apiClient.get<CalendarEvent[]>(
        `${ENDPOINTS.CALENDAR_EVENT.LIST}?${params.toString()}&limit=1000`
      );
    },
  });
}
```

#### F. Frontend Mutation Hooks

**Claude Code will use skill:**

```
/mutation-hooks calendar-event

Feature: calendar-event
Mutations:
- useCreateCalendarEvent
- useUpdateCalendarEvent
- useDeleteCalendarEvent
```

**Generated:** Added to same hooks file

#### G. Frontend List Page

**Claude Code will use skill:**

```
/data-table-page calendar-event

Feature: calendar-event
Route: /admin/calendar-events
Columns: title, event_type, start_date, end_date, location, actions
Search: by title and description
Filters: event_type dropdown, date range picker
Role: ADMIN, WHS
```

**Generated:**

`aegira-frontend/src/features/calendar/pages/AdminCalendarEventsPage.tsx`

- DataTable with pagination
- Search functionality
- Event type filter
- Date range filter
- Actions column

#### H. Frontend Calendar View Page

**Claude Code will create custom page:**

`aegira-frontend/src/features/calendar/pages/CalendarViewPage.tsx`

- Monthly calendar view
- Uses `useCalendarEventsByDateRange` hook
- Shows events on calendar days
- Click event to view details
- Navigate between months

**Note:** Claude Code will check existing UI components first (like calendar libraries), then create following AEGIRA patterns.

#### I. Frontend Form Pages

**Claude Code will use skill:**

```
/form-component calendar-event create

Feature: calendar-event
Page: create
Fields: title, description, startDate (DateTime), endDate (DateTime), eventType (select), location, isAllDay (checkbox)
Route: /admin/calendar-events/create
Validation:
- endDate must be after startDate
- title required
- startDate required
```

```
/form-component calendar-event edit

Feature: calendar-event
Page: edit
Same fields as create
Route: /admin/calendar-events/:id/edit
```

**Generated:**
- `AdminCalendarEventCreatePage.tsx`
- `AdminCalendarEventEditPage.tsx`

#### J. Routes

**Claude Code will:**

1. Edit `aegira-frontend/src/config/routes.config.ts`:
```typescript
export const ROUTES = {
  // ... existing routes
  ADMIN_CALENDAR_EVENTS: '/admin/calendar-events',
  ADMIN_CALENDAR_EVENT_CREATE: '/admin/calendar-events/create',
  ADMIN_CALENDAR_EVENT_EDIT: '/admin/calendar-events/:id/edit',
  CALENDAR_VIEW: '/calendar',
} as const;
```

2. Edit `aegira-frontend/src/routes/index.tsx`:
```typescript
const AdminCalendarEventsPage = lazy(() => import('@/features/calendar/pages/AdminCalendarEventsPage'));
const CalendarViewPage = lazy(() => import('@/features/calendar/pages/CalendarViewPage'));
const AdminCalendarEventCreatePage = lazy(() => import('@/features/calendar/pages/AdminCalendarEventCreatePage'));
const AdminCalendarEventEditPage = lazy(() => import('@/features/calendar/pages/AdminCalendarEventEditPage'));

// Routes
<Route path="/calendar" element={<CalendarViewPage />} />
<Route element={<RouteGuard allowedRoles={['ADMIN', 'WHS']} />}>
  <Route path="/admin/calendar-events" element={<AdminCalendarEventsPage />} />
  <Route path="/admin/calendar-events/create" element={<AdminCalendarEventCreatePage />} />
  <Route path="/admin/calendar-events/:id/edit" element={<AdminCalendarEventEditPage />} />
</Route>
```

#### K. Navigation

**Claude Code will edit:**

`aegira-frontend/src/components/layout/Sidebar.tsx`

Add menu items:
- Calendar (for all users)
- Calendar Events Management (for ADMIN, WHS)

### Step 3: Documentation

**Claude Code will create:**

`docs/features/calendar/README.md`

```markdown
# Calendar Feature

## Overview
Calendar feature allows users to view and manage company events. ADMIN and WHS can create/edit/delete events.

## Database Schema
[CalendarEvent model]

## API Endpoints
[All endpoints documented]

## Frontend Pages
- `/calendar` - Calendar view (monthly)
- `/admin/calendar-events` - List page
- `/admin/calendar-events/create` - Create event
- `/admin/calendar-events/:id/edit` - Edit event

## Business Rules
- Date range filtering
- Event type filtering
- Multi-tenant isolation
- Role-based access control
```

### Step 4: Code Review

**Claude Code will run:**

```
/code-review src/modules/calendar-event/
/code-review src/features/calendar/
```

This ensures all code follows AEGIRA patterns.

### Summary: What Claude Code Did

✅ **Database:** Added CalendarEvent model with proper indexes  
✅ **Backend:** Full CRUD module following patterns  
✅ **Frontend Types:** TypeScript interfaces  
✅ **Frontend Hooks:** Query and mutation hooks  
✅ **Frontend Pages:** List, Calendar view, Create, Edit  
✅ **Routes:** Registered all routes  
✅ **Navigation:** Added to Sidebar  
✅ **Documentation:** Created feature docs  

**All following AEGIRA patterns:**
- Multi-tenant isolation
- Standard response format
- Fire-and-forget audit logs
- Zod validation
- TanStack Query patterns
- Component patterns
- Error handling

### Key Takeaway

**Ikaw lang sasabihin:**
> "Gumawa ka ng Calendar feature. Requirements: [list]. Sundin mo patterns."

**Si Claude Code na bahala:**
- Gumamit ng skills
- Follow patterns
- Generate code
- Add routes
- Create documentation
- Review code

**Ikaw lang mag-verify:**
- Test manually
- Check if tama ang behavior
- Request changes if needed

---

## Command Prompt Examples

### Claude Code Chat Commands (Skills)

Kapag gumagamit ka ng Claude Code, pwede mong gamitin ang skills via slash commands:

#### Backend Module

```
/backend-crud-module announcements

Feature: announcements
Model fields:
- title: string (required, max 200)
- content: string (required, text)
- priority: enum (LOW, NORMAL, HIGH, URGENT, default NORMAL)
- published_at: DateTime (optional)
- expires_at: DateTime (optional)

Roles:
- ADMIN: full CRUD access
- All authenticated users: read-only access
```

#### Query Hooks

```
/query-hooks announcements

Feature: announcements
Hooks needed:
- useAnnouncements (paginated list with search)
- useAnnouncement (single by ID)
```

#### Mutation Hooks

```
/mutation-hooks announcements

Feature: announcements
Mutations:
- useCreateAnnouncement
- useUpdateAnnouncement
- useDeleteAnnouncement
```

#### Data Table Page

```
/data-table-page announcements

Feature: announcements
Route: /admin/announcements
Columns: title, priority, created_at, actions
Search: by title and content
Role: ADMIN only
```

#### Form Component

```
/form-component announcements create

Feature: announcements
Page: create
Fields: title, content, priority, publishedAt, expiresAt
Route: /admin/announcements/create
```

```
/form-component announcements edit

Feature: announcements
Page: edit
Fields: title, content, priority, publishedAt, expiresAt
Route: /admin/announcements/:id/edit
```

#### Code Review

```
/code-review src/modules/announcement/

Review the announcement module against AEGIRA patterns
```

```
/code-review src/features/admin/pages/AdminAnnouncementsPage.tsx

Check if the page follows frontend patterns
```

### Terminal Commands (npm scripts)

#### Pattern System Commands

```bash
# Build skills from patterns (after editing .ai/)
npm run ai:build

# Watch for changes and auto-rebuild
npm run ai:watch

# Validate pattern references
npm run ai:validate

# Preview what would change (dry run)
npm run ai:diff
```

#### Database Commands

```bash
# Navigate to backend directory
cd aegira-backend

# Run migration
npm run db:migrate -- --name add_announcements

# Generate Prisma client
npm run db:generate

# Open Prisma Studio (database GUI)
npm run db:studio

# Seed database
npm run db:seed
```

#### Development Commands

```bash
# Backend development server
cd aegira-backend
npm run dev

# Frontend development server
cd aegira-frontend
npm run dev

# Type checking
cd aegira-backend
npm run typecheck

cd aegira-frontend
npm run build  # Includes typecheck
```

#### Testing Commands

```bash
# Backend tests
cd aegira-backend
npm test                    # Watch mode
npm run test:run            # Run once

# Frontend tests
cd aegira-frontend
npm test                    # Watch mode
npm run test:run            # Run once
```

### Complete Workflow Example (Commands)

#### Step 1: Setup

```bash
# Open terminal at project root
cd "D:\AEGIRA V5"

# Check current directory
pwd
# Output: D:\AEGIRA V5
```

#### Step 2: Database Migration

```bash
# Navigate to backend
cd aegira-backend

# Create migration after editing schema.prisma
npm run db:migrate -- --name add_announcements

# Output:
# Environment variables loaded from .env
# Prisma schema loaded from prisma/schema.prisma
# Datasource "db": PostgreSQL database "aegira_dev"
# 
# The following migration(s) have been created and applied:
#   migrations/20250210_add_announcements/migration.sql
```

#### Step 3: Build Patterns (if you edited .ai/)

```bash
# Go back to root
cd ..

# Build patterns
npm run ai:build

# Output:
# Building skills...
# ✓ Built .claude/skills/backend-crud-module/SKILL.md
# ✓ Built .claude/skills/query-hooks/SKILL.md
# ...
# ✓ All skills built successfully
```

#### Step 4: Start Development Servers

```bash
# Terminal 1: Backend
cd aegira-backend
npm run dev

# Output:
# > aegira-backend@1.0.0 dev
# > tsx watch src/app.ts
# 
# Server running on http://localhost:3000

# Terminal 2: Frontend
cd aegira-frontend
npm run dev

# Output:
# > aegira-frontend@1.0.0 dev
# > vite
# 
#   VITE v5.x.x  ready in 500 ms
#   ➜  Local:   http://localhost:5173/
```

#### Step 5: Test Your Feature

```bash
# Backend tests
cd aegira-backend
npm test src/modules/announcement/__tests__/

# Frontend tests
cd aegira-frontend
npm test src/features/admin/pages/AdminAnnouncementsPage.test.tsx
```

### Git Commands (After Feature Complete)

```bash
# Check status
git status

# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add announcements feature

- Add Announcement model to Prisma schema
- Create backend CRUD module (routes, controller, repository, validator)
- Add frontend hooks (query and mutation)
- Create list and form pages
- Add routes and navigation
- Add feature documentation"

# Push to remote
git push origin master
```

### PowerShell Commands (Windows)

```powershell
# Navigate to project
cd "D:\AEGIRA V5"

# List files in .ai/patterns
Get-ChildItem .ai\patterns\backend\

# Open file in VS Code
code .ai\patterns\backend\repository-pattern.md

# Run npm script
npm run ai:build

# Check if file exists
Test-Path "docs\features\announcements\README.md"

# Create directory if doesn't exist
New-Item -ItemType Directory -Force -Path "docs\features\announcements"
```

### Common Command Combinations

#### Full Feature Setup

```bash
# 1. Edit schema
code aegira-backend/prisma/schema.prisma

# 2. Run migration
cd aegira-backend && npm run db:migrate -- --name add_feature_name && cd ..

# 3. Build patterns (if needed)
npm run ai:build

# 4. Start dev servers (in separate terminals)
# Terminal 1:
cd aegira-backend && npm run dev

# Terminal 2:
cd aegira-frontend && npm run dev
```

#### Quick Validation

```bash
# Validate patterns
npm run ai:validate

# Type check backend
cd aegira-backend && npm run typecheck && cd ..

# Type check frontend
cd aegira-frontend && npm run build && cd ..
```

### Troubleshooting Commands

```bash
# Check if Prisma client is generated
cd aegira-backend
npm run db:generate

# Reset database (WARNING: deletes all data)
npm run db:migrate reset

# Check for linting errors
cd aegira-frontend
npm run lint

# Format code
npm run format
```

### Example: Complete Feature Creation Session

```bash
# === SESSION START ===

# 1. Navigate to project
cd "D:\AEGIRA V5"

# 2. Check current branch
git branch
# Output: * master

# 3. Create feature branch (optional)
git checkout -b feature/announcements

# 4. Edit Prisma schema
code aegira-backend/prisma/schema.prisma
# [Add Announcement model]

# 5. Run migration
cd aegira-backend
npm run db:migrate -- --name add_announcements
cd ..

# 6. Build patterns (if edited)
npm run ai:build

# 7. Now use Claude Code skills:
#    - /backend-crud-module announcements
#    - /query-hooks announcements
#    - /mutation-hooks announcements
#    - /data-table-page announcements
#    - /form-component announcements create
#    - /form-component announcements edit

# 8. Add routes manually (edit files)

# 9. Test backend
cd aegira-backend
npm run typecheck
npm test
cd ..

# 10. Test frontend
cd aegira-frontend
npm run build
npm test
cd ..

# 11. Create documentation
mkdir docs\features\announcements
code docs\features\announcements\README.md
# [Write documentation]

# 12. Review code
# Use Claude Code: /code-review src/modules/announcement/

# 13. Commit changes
git add .
git commit -m "feat: add announcements feature"
git push origin feature/announcements

# === SESSION END ===
```

---

## FAQ

### Q: Kailan ko dapat i-edit ang `.ai/patterns/`?

**A:** Kapag:
- May bagong coding pattern na gusto mong i-standardize
- May existing pattern na kailangan i-update
- May common mistake na gusto mong i-prevent

**Example:** Kung gusto mong i-standardize ang pag-handle ng file uploads, create:
```
.ai/patterns/backend/file-upload-pattern.md
```

### Q: Kailan ko dapat i-edit ang `.ai/skills/`?

**A:** Kapag:
- May bagong skill na gusto mong i-create
- May existing skill na kailangan i-update (add/remove patterns)
- May new pattern na gusto mong i-include sa skill

**Example:** Kung gusto mong gumawa ng skill para sa "export-to-excel" feature:
```
.ai/skills/export-excel/SKILL.md
```

### Q: Kailan ko dapat i-run ang `npm run ai:build`?

**A:** Kapag:
- Nag-edit ka ng pattern file
- Nag-edit ka ng skill template
- Nag-update ka ng `sync.config.json`
- Bago ka mag-commit ng changes sa `.ai/` directory

**Tip:** Use `npm run ai:watch` para auto-rebuild on changes.

### Q: Paano ko malalaman kung tama ang generated code?

**A:** Use code review skill:
```
/code-review src/modules/announcement/
/code-review src/features/admin/pages/AdminAnnouncementsPage.tsx
```

### Q: Paano kung walang existing pattern para sa gusto kong feature?

**A:**
1. Check similar patterns first:
   ```bash
   ls .ai/patterns/backend/
   ls .ai/patterns/frontend/
   ```

2. If walang similar, create new pattern:
   ```bash
   code .ai/patterns/backend/new-pattern.md
   ```

3. Follow pattern format:
   ```markdown
   # Pattern Name
   > One-line description

   ## When to Use
   - Bullet points

   ## Canonical Implementation
   ```typescript
   // Code examples
   ```

   ## Rules
   - ✅ DO this
   - ❌ NEVER this

   ## Common Mistakes
   ### ❌ WRONG
   ### ✅ CORRECT
   ```

4. Update skill if needed:
   ```bash
   code .ai/skills/backend-crud-module/SKILL.md
   # Add: <!-- @pattern: backend/new-pattern -->
   ```

5. Update sync config:
   ```bash
   code .ai/sync.config.json
   ```

6. Rebuild:
   ```bash
   npm run ai:build
   npm run ai:validate
   ```

### Q: Paano kung gusto kong i-customize ang generated code?

**A:** Skills generate base code following patterns. Pwede mong i-customize after generation:
- Add custom validation
- Add custom business logic
- Add custom UI components
- Add custom error handling

**Important:** Make sure customizations still follow AEGIRA patterns (multi-tenant, error handling, etc.)

### Q: Saan ko dapat i-document ang feature?

**A:** 
- **Feature-specific docs:** `docs/features/<feature-name>/README.md`
- **Pattern updates:** Update `.ai/patterns/` files
- **Guide updates:** Update `docs/guides/HOW-TO-ADD-NEW-FEATURE.md`
- **Architecture changes:** Update `docs/architecture/`

---

## Summary

### Workflow Summary

```
1. Plan feature (fields, roles, pages)
   ↓
2. Database schema (Prisma)
   ↓
3. Backend module (/backend-crud-module)
   ↓
4. Frontend types + endpoints
   ↓
5. Frontend hooks (/query-hooks, /mutation-hooks)
   ↓
6. Frontend pages (/data-table-page, /form-component)
   ↓
7. Routes + navigation
   ↓
8. Documentation (docs/features/)
```

### Key Takeaways

1. **Always use skills** - They ensure consistency
2. **Patterns are source of truth** - Edit `.ai/patterns/` for new patterns
3. **Document your features** - Create `docs/features/<name>/README.md`
4. **Rebuild after changes** - Run `npm run ai:build` after editing `.ai/`
5. **Validate your work** - Use `/code-review` to check patterns

---

## Related Documentation

- [HOW-TO-ADD-NEW-FEATURE.md](./HOW-TO-ADD-NEW-FEATURE.md) - Complete feature creation guide
- [HOW-TO-SYNC-PATTERNS.md](./HOW-TO-SYNC-PATTERNS.md) - Pattern system technical details
- [HOW-TO-USE-SKILLS.md](./HOW-TO-USE-SKILLS.md) - Skills usage guide
- [PATTERN-SYSTEM-SAMPLE.md](./PATTERN-SYSTEM-SAMPLE.md) - Pattern → code walkthrough
