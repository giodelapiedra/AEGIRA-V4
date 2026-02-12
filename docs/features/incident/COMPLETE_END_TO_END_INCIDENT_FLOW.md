# Complete Incident Flow - Worker to WHS

## End-to-End System Flow (Technical Implementation Plan)

---

## 1. User Flow Overview

```
STEP 1: Worker Dashboard → Click [Report Incident]
    ↓
STEP 2: Worker fills Report Incident form (type, severity, title, location, description)
    ↓
STEP 3: Worker submits → Incident created (PENDING) → Toast + redirect to My Incidents
    ↓
STEP 4: WHS sees incident in Pending Incidents DataTable
    ↓
STEP 5: WHS clicks row → Views Incident Detail page
    ↓
STEP 6: WHS approves (creates case) or rejects (with reason)
    ↓
STEP 7: Worker receives in-app notification
    ↓
STEP 8: Worker views status in My Incidents page (DataTable with status filter)
    ↓
STEP 9: Worker views Incident Detail (read-only) or Case Detail (read-only)
```

---

## 2. Role Mapping

The plan uses "WHS" to describe a Workplace Health & Safety reviewer. In the AEGIRA role system:

| Plan Term | AEGIRA Role | Access |
|-----------|-------------|--------|
| Worker | `WORKER` | Submit incidents, view own incidents/cases (read-only) |
| WHS | `WHS` | Review all incidents, approve/reject, manage cases (dedicated role) |
| Admin | `ADMIN` | Full system access including all WHS functions |
| Team Lead | `TEAM_LEAD` | Submit incidents, view own incidents (read-only) |
| Supervisor | `SUPERVISOR` | Submit incidents, view own incidents (read-only) |

**Decision:** A new `WHS` role is added to the `Role` enum. WHS officers can ONLY manage incidents and cases — they cannot access team management, worker management, settings, schedules, holidays, or audit logs. `ADMIN` retains full access to everything including WHS functions. The WHS pages live under `/admin/incidents` and `/admin/cases` routes, accessible by both `ADMIN` and `WHS` roles.

---

## 3. Database Schema (Prisma)

### 3.1 New Enums

```prisma
enum IncidentType {
  PHYSICAL_INJURY
  ILLNESS_SICKNESS
  MENTAL_HEALTH
  MEDICAL_EMERGENCY
  HEALTH_SAFETY_CONCERN
  OTHER
}

enum IncidentSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum IncidentStatus {
  PENDING
  APPROVED
  REJECTED
}

enum CaseStatus {
  OPEN
  INVESTIGATING
  RESOLVED
  CLOSED
}

enum RejectionReason {
  DUPLICATE_REPORT
  INSUFFICIENT_INFORMATION
  NOT_WORKPLACE_INCIDENT
  OTHER
}
```

### 3.2 Incident Model

Uses a review workflow pattern (PENDING -> APPROVED/REJECTED) with `reviewed_by`/`reviewed_at` tracking, following the `MissedCheckIn` service status transition pattern for validation.

```prisma
model Incident {
  id                    String            @id @default(uuid())
  company_id            String
  incident_number       Int               // Sequential per company, set in service layer
  reporter_id           String
  incident_type         IncidentType
  severity              IncidentSeverity
  title                 String
  location              String?
  description           String
  status                IncidentStatus    @default(PENDING)
  reviewed_by           String?
  reviewed_at           DateTime?
  rejection_reason      RejectionReason?
  rejection_explanation String?
  created_at            DateTime          @default(now())
  updated_at            DateTime          @updatedAt

  // Relations
  company   Company  @relation(fields: [company_id], references: [id], onDelete: Cascade)
  reporter  Person   @relation("ReportedIncidents", fields: [reporter_id], references: [id], onDelete: Cascade)
  reviewer  Person?  @relation("ReviewedIncidents", fields: [reviewed_by], references: [id], onDelete: SetNull)
  case      Case?

  @@unique([company_id, incident_number])
  @@index([company_id])
  @@index([company_id, status])
  @@index([reporter_id])
  @@index([status])
  @@index([created_at])
  @@map("incidents")
}
```

**Incident number strategy:** No `@default(autoincrement())` — PostgreSQL sequences are global, not per-company, so they would produce gaps per tenant. Instead, the number is generated in `incident.service.ts` inside the create transaction:

```typescript
// incident.service.ts — inside Prisma.$transaction
const lastIncident = await tx.incident.findFirst({
  where: { company_id: companyId },
  orderBy: { incident_number: 'desc' },
  select: { incident_number: true },
});
const incidentNumber = (lastIncident?.incident_number ?? 0) + 1;
```

The `@@unique([company_id, incident_number])` compound constraint guarantees uniqueness even under concurrent writes — if two transactions race, one will fail the unique check (Prisma error `P2002`). The service layer wraps the transaction in a retry loop (max 3 attempts) to handle this:

```typescript
// incident.service.ts — retry wrapper
async createIncident(data: CreateIncidentInput, companyId: string, reporterId: string): Promise<Incident> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const last = await tx.incident.findFirst({
          where: { company_id: companyId },
          orderBy: { incident_number: 'desc' },
          select: { incident_number: true },
        });
        const incidentNumber = (last?.incident_number ?? 0) + 1;
        return tx.incident.create({ data: { ...data, company_id: companyId, reporter_id: reporterId, incident_number: incidentNumber } });
      });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002' && attempt < 2) continue;
      throw e;
    }
  }
  throw new AppError('CONFLICT', 'Failed to generate incident number, please retry', 409);
}
```

The human-readable format `INC-YYYY-NNNN` is derived on read in the controller/frontend, not stored as a string.

### 3.3 Case Model

Created only when an incident is approved. Linked 1:1 to the incident.

```prisma
model Case {
  id              String      @id @default(uuid())
  company_id      String
  case_number     Int         // Sequential per company, set in incident.service.ts during approval
  incident_id     String      @unique
  assigned_to     String?
  status          CaseStatus  @default(OPEN)
  notes           String?
  resolved_at     DateTime?
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt

  // Relations
  company   Company   @relation(fields: [company_id], references: [id], onDelete: Cascade)
  incident  Incident  @relation(fields: [incident_id], references: [id], onDelete: Cascade)
  assignee  Person?   @relation("AssignedCases", fields: [assigned_to], references: [id], onDelete: SetNull)

  @@unique([company_id, case_number])
  @@index([company_id])
  @@index([company_id, status])
  @@index([assigned_to])
  @@index([status])
  @@map("cases")
}
```

**Case number strategy:** Same as incident — generated in service layer inside the approval transaction, not via `autoincrement()`:

```typescript
// incident.service.ts — inside approve $transaction
const lastCase = await tx.case.findFirst({
  where: { company_id: companyId },
  orderBy: { case_number: 'desc' },
  select: { case_number: true },
});
const caseNumber = (lastCase?.case_number ?? 0) + 1;
```

### 3.4 Existing Model Updates

**Person model** — add relations:
```prisma
model Person {
  // ... existing fields ...
  reported_incidents  Incident[]  @relation("ReportedIncidents")
  reviewed_incidents  Incident[]  @relation("ReviewedIncidents")
  assigned_cases      Case[]      @relation("AssignedCases")
}
```

**Company model** — add relations:
```prisma
model Company {
  // ... existing fields ...
  incidents  Incident[]
  cases      Case[]
}
```

### 3.5 Extend Existing Enums

```prisma
enum EventType {
  // ... existing values ...
  INCIDENT_CREATED
  INCIDENT_APPROVED
  INCIDENT_REJECTED
  CASE_CREATED
  CASE_UPDATED
  CASE_RESOLVED
}

enum NotificationType {
  // ... existing values ...
  INCIDENT_SUBMITTED
  INCIDENT_APPROVED
  INCIDENT_REJECTED
}
```

---

## 4. API Endpoints

All endpoints prefixed with `/api/v1`. Auth + tenant middleware applied to all.

### 4.1 Incident Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `POST` | `/incidents` | `WORKER`, `TEAM_LEAD`, `SUPERVISOR`, `WHS`, `ADMIN` | Create incident report |
| `GET` | `/incidents/my` | All authenticated | List own incidents (paginated, filterable by status) |
| `GET` | `/incidents/:id` | Owner or `ADMIN`/`WHS` | Get incident detail |
| `GET` | `/incidents` | `ADMIN`, `WHS` | List all incidents (paginated, filterable by status/severity/type) |
| `GET` | `/incidents/:id/timeline` | Owner or `ADMIN`/`WHS` | Get incident event timeline |
| `PATCH` | `/incidents/:id/approve` | `ADMIN`, `WHS` | Approve incident (creates case in transaction) |
| `PATCH` | `/incidents/:id/reject` | `ADMIN`, `WHS` | Reject incident (requires reason + explanation) |

### 4.2 Case Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/cases` | `ADMIN`, `WHS` | List all cases (paginated, filterable by status) |
| `GET` | `/cases/:id` | Owner of linked incident or `ADMIN`/`WHS` | Get case detail (includes incident + reporter info) |
| `PATCH` | `/cases/:id` | `ADMIN`, `WHS` | Update case (assign, add notes, change status) |

### 4.3 Request/Response Shapes

**POST `/incidents`** (Create)
```typescript
// Request body
{
  incidentType: 'PHYSICAL_INJURY' | 'ILLNESS_SICKNESS' | 'MENTAL_HEALTH' | 'MEDICAL_EMERGENCY' | 'HEALTH_SAFETY_CONCERN' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;       // 1-200 chars
  location?: string;   // max 200 chars
  description: string; // 1-2000 chars
}

// Response: { success: true, data: Incident }
```

**PATCH `/incidents/:id/reject`** (Reject)
```typescript
// Request body
{
  rejectionReason: 'DUPLICATE_REPORT' | 'INSUFFICIENT_INFORMATION' | 'NOT_WORKPLACE_INCIDENT' | 'OTHER';
  rejectionExplanation: string; // 1-500 chars, required
}

// Response: { success: true, data: Incident }
```

**GET `/incidents`** (List — Admin)
```typescript
// Query params: ?page=1&limit=20&status=PENDING&severity=HIGH&type=PHYSICAL_INJURY&search=keyword

// Response: { success: true, data: { items: Incident[], pagination: {...}, statusCounts: {...} } }
```

**GET `/incidents/my`** (List — Worker's own)
```typescript
// Query params: ?page=1&limit=20&status=PENDING

// Response: { success: true, data: { items: Incident[], pagination: {...}, statusCounts: {...} } }
```

---

## 5. Backend Module Structure

### 5.1 Incident Module

```
aegira-backend/src/modules/incident/
├── incident.routes.ts        # Route definitions with middleware
├── incident.controller.ts    # Request handling, response mapping
├── incident.service.ts       # Approval transaction, status validation
├── incident.repository.ts    # Prisma queries, extends BaseRepository
└── incident.validator.ts     # Zod schemas for request validation
```

**`incident.service.ts`** is required (not optional) because the approve action is a multi-step transaction:

```
Approve Flow:
  Prisma.$transaction (atomic):
    1. Validate incident exists and status === PENDING
    2. Update incident status → APPROVED, set reviewed_by + reviewed_at
    3. Create Case record linked to incident (with retry for case_number)
    4. Create Event (INCIDENT_APPROVED) — inside transaction for consistency
    5. Create Event (CASE_CREATED) — inside transaction for consistency

  After transaction (fire-and-forget, never block):
    6. Create Notification for reporter — via NotificationRepository
    7. Create AuditLog entry — via logAudit()
```

**Important:** Events are created inside `$transaction` because they are part of the atomic state change. Notifications and audit logs are fire-and-forget OUTSIDE the transaction — their failure must never roll back the approval.

**Status transition validation** (follows MissedCheckInService pattern):
```typescript
const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: [],   // terminal
  REJECTED: [],   // terminal
};
```

### 5.2 Case Module

```
aegira-backend/src/modules/case/
├── case.routes.ts
├── case.controller.ts
├── case.service.ts          # Status transitions, assignment
├── case.repository.ts
└── case.validator.ts
```

**Case status transitions:**
```typescript
const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ['INVESTIGATING', 'RESOLVED', 'CLOSED'],
  INVESTIGATING: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};
```

### 5.3 Route Registration

```typescript
// incident.routes.ts
const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

const whsOrAdmin = roleMiddleware(['ADMIN', 'WHS']);
const allAuthenticated = roleMiddleware(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'WHS']);

// IMPORTANT: Specific routes BEFORE parameterized routes
router.get('/my', allAuthenticated, zValidator('query', getMyIncidentsQuerySchema), getMyIncidents);
router.post('/', allAuthenticated, zValidator('json', createIncidentSchema), createIncident);
router.get('/', whsOrAdmin, zValidator('query', getIncidentsQuerySchema), getIncidents);
router.get('/:id', allAuthenticated, getIncidentById);
router.get('/:id/timeline', allAuthenticated, getIncidentTimeline);
router.patch('/:id/approve', whsOrAdmin, approveIncident);
router.patch('/:id/reject', whsOrAdmin, zValidator('json', rejectIncidentSchema), rejectIncident);
```

### 5.4 Notification Integration

Uses `NotificationRepository` directly (same pattern as `missed-check-in-detector.ts`). Wrapped in try/catch — notification failure must never break the main operation:

```typescript
// Inside incident.service.ts — AFTER the $transaction completes
private async notifyIncidentApproved(companyId: string, reporterId: string, incidentNumber: number, caseNumber: number): Promise<void> {
  try {
    const notifRepo = new NotificationRepository(this.prisma, companyId);
    await notifRepo.create({
      personId: reporterId,
      type: 'INCIDENT_APPROVED',
      title: 'Incident Report Approved',
      message: `Your incident report #INC-${incidentNumber} has been approved. Case #CASE-${caseNumber} has been created.`,
    });
  } catch (error) {
    logger.error({ error, reporterId, incidentNumber }, 'Failed to send incident approval notification');
  }
}

private async notifyIncidentRejected(companyId: string, reporterId: string, incidentNumber: number, reason: string): Promise<void> {
  try {
    const notifRepo = new NotificationRepository(this.prisma, companyId);
    await notifRepo.create({
      personId: reporterId,
      type: 'INCIDENT_REJECTED',
      title: 'Incident Report Not Approved',
      message: `Your incident report #INC-${incidentNumber} was not approved. Reason: ${reason}.`,
    });
  } catch (error) {
    logger.error({ error, reporterId, incidentNumber }, 'Failed to send incident rejection notification');
  }
}
```

**On incident submission:** All active WHS and ADMIN users in the company are notified via batch notification:

```typescript
// Inside incident.service.ts — AFTER the create $transaction completes
private async notifyWhsAndAdminIncidentSubmitted(
  companyId: string,
  incidentNumber: number,
  reporterName: string,
  severity: IncidentSeverity,
  title: string
): Promise<void> {
  try {
    const whsAndAdmins = await this.prisma.person.findMany({
      where: {
        company_id: companyId,
        role: { in: ['WHS', 'ADMIN'] },
        is_active: true,
      },
      select: { id: true },
    });
    if (whsAndAdmins.length === 0) return;

    const notifRepo = new NotificationRepository(this.prisma, companyId);
    await notifRepo.createMany(
      whsAndAdmins.map((person) => ({
        personId: person.id,
        type: 'INCIDENT_SUBMITTED' as const,
        title: 'New Incident Report Submitted',
        message: `${reporterName} submitted incident #INC-${incidentNumber} (${severity}): ${title}`,
      }))
    );
  } catch (error) {
    logger.error({ error, companyId, incidentNumber }, 'Failed to send incident submission notifications');
  }
}
```

Notifications are in-app only (existing system). No email/SMS — those do not exist in the current system.

### 5.5 Audit Logging

Fire-and-forget via `logAudit()` from `shared/audit.ts`. Requires `companyId` and `personId` parameters (matches actual function signature):

```typescript
// After create
logAudit({ companyId, personId: reporterId, action: 'INCIDENT_CREATED', entityType: 'incident', entityId: incident.id, details: { incidentNumber } });

// After approve
logAudit({ companyId, personId: reviewerId, action: 'INCIDENT_APPROVED', entityType: 'incident', entityId: incident.id, details: { caseId, caseNumber } });

// After reject
logAudit({ companyId, personId: reviewerId, action: 'INCIDENT_REJECTED', entityType: 'incident', entityId: incident.id, details: { reason, rejectionReason } });
```

### 5.6 Event Sourcing

Record all state changes as `Event` entities for the Timeline view. **All events use `entity_type = 'incident'` and `entity_id = incidentId`** — including case events (CASE_CREATED, CASE_UPDATED, CASE_RESOLVED). This keeps the timeline query simple: one entity_type + one entity_id returns the full history.

```typescript
// incident.service.ts — example: inside approve transaction
await tx.event.create({
  data: {
    company_id: companyId,
    person_id: reviewerId,
    event_type: 'INCIDENT_APPROVED',
    entity_type: 'incident',
    entity_id: incident.id,
    payload: { incidentNumber, caseId, caseNumber },
  },
});

await tx.event.create({
  data: {
    company_id: companyId,
    person_id: reviewerId,
    event_type: 'CASE_CREATED',
    entity_type: 'incident',    // NOT 'case' — keeps timeline query simple
    entity_id: incident.id,     // References the parent incident
    payload: { caseId, caseNumber, status: 'OPEN' },
  },
});
```

**Timeline query** (used by both IncidentDetailPage and CaseDetailPage):
```typescript
// incident.repository.ts
async getTimeline(incidentId: string): Promise<Event[]> {
  return this.prisma.event.findMany({
    where: {
      company_id: this.companyId,
      entity_type: 'incident',
      entity_id: incidentId,
    },
    orderBy: { created_at: 'asc' },
  });
}
```

This returns the full lifecycle: `INCIDENT_CREATED` → `INCIDENT_APPROVED` → `CASE_CREATED` → `CASE_UPDATED` → `CASE_RESOLVED` in one query.

---

## 6. Frontend Structure

### 6.1 Feature Directory

```
src/features/incident/
├── pages/
│   ├── ReportIncidentPage.tsx      # All roles: form to submit incident
│   ├── MyIncidentsPage.tsx         # All roles: own incidents list (DataTable + status tabs)
│   ├── IncidentDetailPage.tsx      # All roles: incident detail (read-only for non-admin, actions for admin)
│   │                               # Workers see case info inline here when status=APPROVED
│   ├── AdminIncidentsPage.tsx      # Admin: all incidents list (DataTable + status tabs + filters)
│   └── CaseDetailPage.tsx          # Admin only: full case management (status, assign, notes, timeline)
├── components/
│   ├── IncidentForm.tsx            # React Hook Form + Zod form (used by ReportIncidentPage)
│   ├── IncidentStatusBadge.tsx     # PENDING/APPROVED/REJECTED badge
│   ├── CaseStatusBadge.tsx         # OPEN/INVESTIGATING/RESOLVED/CLOSED badge
│   ├── SeverityBadge.tsx           # LOW/MEDIUM/HIGH/CRITICAL badge
│   ├── RejectionDialog.tsx         # Dialog with reason select + explanation textarea
│   └── IncidentTimeline.tsx        # Timeline from Event records (used by both detail pages)
└── hooks/
    ├── useMyIncidents.ts           # All roles: own incidents (paginated + status filter)
    ├── useIncidents.ts             # Admin: all incidents (paginated + filters)
    ├── useIncident.ts              # Single incident by ID (includes case info if approved)
    ├── useCreateIncident.ts        # Mutation: POST /incidents
    ├── useApproveIncident.ts       # Mutation: PATCH /incidents/:id/approve
    ├── useRejectIncident.ts        # Mutation: PATCH /incidents/:id/reject
    ├── useIncidentTimeline.ts      # Query: Event records for incident timeline
    ├── useCases.ts                 # Admin: all cases (paginated)
    ├── useCase.ts                  # Admin: single case by ID
    └── useUpdateCase.ts            # Admin: Mutation: PATCH /cases/:id
```

### 6.2 Types

```typescript
// src/types/incident.types.ts

export type IncidentType =
  | 'PHYSICAL_INJURY'
  | 'ILLNESS_SICKNESS'
  | 'MENTAL_HEALTH'
  | 'MEDICAL_EMERGENCY'
  | 'HEALTH_SAFETY_CONCERN'
  | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CaseStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export type RejectionReason =
  | 'DUPLICATE_REPORT'
  | 'INSUFFICIENT_INFORMATION'
  | 'NOT_WORKPLACE_INCIDENT'
  | 'OTHER';

export interface Incident {
  id: string;
  incidentNumber: number;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  teamName: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  location: string | null;
  description: string;
  status: IncidentStatus;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  rejectionReason: RejectionReason | null;
  rejectionExplanation: string | null;
  caseId: string | null;
  caseNumber: number | null;
  caseStatus: CaseStatus | null;
  caseNotes: string | null;
  createdAt: string;
}

export interface Case {
  id: string;
  caseNumber: number;
  incidentId: string;
  incident: Incident;
  assignedTo: string | null;
  assigneeName: string | null;
  status: CaseStatus;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CreateIncidentData {
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  location?: string;
  description: string;
}

export interface RejectIncidentData {
  rejectionReason: RejectionReason;
  rejectionExplanation: string;
}

export interface UpdateCaseData {
  assignedTo?: string;
  status?: CaseStatus;
  notes?: string;
}

export interface IncidentEvent {
  id: string;
  eventType: string;   // INCIDENT_CREATED | INCIDENT_APPROVED | INCIDENT_REJECTED | CASE_CREATED | CASE_UPDATED | CASE_RESOLVED
  personId: string | null;
  personName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

// Custom response type for incident list endpoints (includes statusCounts beyond PaginatedResponse<T>)
// Do NOT use PaginatedResponse<Incident> — that type does not include statusCounts
export interface IncidentListResponse {
  items: Incident[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<IncidentStatus, number>;
}
```

### 6.3 Endpoints

```typescript
// Add to src/lib/api/endpoints.ts

INCIDENT: {
  CREATE: '/incidents',
  LIST: '/incidents',
  MY: '/incidents/my',
  BY_ID: (id: string) => `/incidents/${id}`,
  TIMELINE: (id: string) => `/incidents/${id}/timeline`,
  APPROVE: (id: string) => `/incidents/${id}/approve`,
  REJECT: (id: string) => `/incidents/${id}/reject`,
},
CASE: {
  LIST: '/cases',
  BY_ID: (id: string) => `/cases/${id}`,
  UPDATE: (id: string) => `/cases/${id}`,
},
```

### 6.4 Routes

```typescript
// Add to src/config/routes.config.ts

// Worker routes
MY_INCIDENTS: '/my-incidents',
REPORT_INCIDENT: '/report-incident',
INCIDENT_DETAIL: '/incidents/:id',

// Admin routes
ADMIN_INCIDENTS: '/admin/incidents',
ADMIN_INCIDENT_DETAIL: '/admin/incidents/:id',
ADMIN_CASES: '/admin/cases',
ADMIN_CASE_DETAIL: '/admin/cases/:id',
```

### 6.5 Route Registration

Routes must be added INSIDE the existing route structure in `src/routes/index.tsx`. The app uses a single `<RouteGuard><AppLayout /></RouteGuard>` wrapper — do NOT create separate route guards.

```typescript
// src/routes/index.tsx — add INSIDE the existing structure

<Route element={<RouteGuard><AppLayout /></RouteGuard>}>

  {/* ... existing common routes (dashboard, notifications, settings) ... */}

  {/* Incident routes — all authenticated users */}
  <Route path={ROUTES.MY_INCIDENTS} element={<MyIncidentsPage />} />
  <Route path={ROUTES.REPORT_INCIDENT} element={<ReportIncidentPage />} />
  <Route path={ROUTES.INCIDENT_DETAIL} element={<IncidentDetailPage />} />

  {/* ... existing role-restricted routes ... */}

  {/* Incident Management — WHS + ADMIN */}
  <Route element={<RouteGuard allowedRoles={['ADMIN', 'WHS']} />}>
    <Route path={ROUTES.ADMIN_INCIDENTS} element={<AdminIncidentsPage />} />
    <Route path={ROUTES.ADMIN_INCIDENT_DETAIL} element={<IncidentDetailPage />} />
    <Route path={ROUTES.ADMIN_CASES} element={<AdminCasesPage />} />
    <Route path={ROUTES.ADMIN_CASE_DETAIL} element={<CaseDetailPage />} />
  </Route>

  <Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
    {/* ... existing admin routes (teams, workers, settings, etc.) ... */}
  </Route>
</Route>
```

**CRITICAL:** Worker incident routes (`MY_INCIDENTS`, `REPORT_INCIDENT`, `INCIDENT_DETAIL`) go in the common authenticated section — NOT inside a separate `<RouteGuard>`. Admin routes go inside the existing `allowedRoles={['ADMIN']}` block. Creating separate guards would break `<AppLayout />` (no sidebar/header).

---

## 7. Frontend Page Specifications

### 7.1 Report Incident Page (Worker)

**Pattern:** Form page (React Hook Form + Zod), follows existing create page pattern.

**Route:** `/report-incident`

**Components used:** `PageHeader` (with back button), `Card`, form fields from shadcn/ui

```typescript
// Zod schema
const createIncidentSchema = z.object({
  incidentType: z.enum(['PHYSICAL_INJURY', 'ILLNESS_SICKNESS', 'MENTAL_HEALTH', 'MEDICAL_EMERGENCY', 'HEALTH_SAFETY_CONCERN', 'OTHER'], {
    required_error: 'Please select an incident type',
  }),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    required_error: 'Please select a severity level',
  }),
  title: z.string().min(1, 'Title is required').max(200),
  location: z.string().max(200).optional(),
  description: z.string().min(1, 'Description is required').max(2000),
});
```

**Form fields:**
- Incident Type — `Select` component (6 options)
- Severity — `Select` component (4 options) with description text below each
- Title — `Input` (required)
- Location — `Input` (optional)
- Description — `Textarea` (required)

**On submit:**
1. `mutateAsync(data)` via `useCreateIncident`
2. Success → Toast "Incident report submitted" + navigate to `ROUTES.MY_INCIDENTS`
3. Error → Toast with error message

No separate confirmation page — follows existing system pattern of toast + redirect.

### 7.2 My Incidents Page (Worker)

**Pattern:** Paginated DataTable with status filter tabs, follows `NotificationsPage` and `MissedCheckInsPage` pattern.

**Route:** `/my-incidents`

**Components used:** `PageHeader` (title + "Report Incident" action button), `Tabs`, `DataTable`, `PageLoader`, `IncidentStatusBadge`, `SeverityBadge`

```typescript
// Columns defined OUTSIDE component
const columns: ColumnDef<Incident>[] = [
  { accessorKey: 'incidentNumber', header: 'Incident #',
    cell: ({ row }) => formatIncidentNumber(row.original.incidentNumber, row.original.createdAt) },
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'incidentType', header: 'Type',
    cell: ({ row }) => formatIncidentType(row.original.incidentType) },
  { accessorKey: 'severity', header: 'Severity',
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} /> },
  { accessorKey: 'status', header: 'Status',
    cell: ({ row }) => <IncidentStatusBadge status={row.original.status} /> },
  { accessorKey: 'createdAt', header: 'Submitted',
    cell: ({ row }) => formatDate(row.original.createdAt) },
  // Actions column: View button → navigates to ROUTES.INCIDENT_DETAIL
];
```

**Status tabs:** All | Pending | Approved | Rejected (with counts from `statusCounts` in API response)

**Incident number display format:** `INC-{YYYY}-{NNNN}` derived from `incidentNumber` (Int) + `createdAt` (year). Helper function: `formatIncidentNumber(num: number, createdAt: string) => INC-${year}-${String(num).padStart(4, '0')}`

### 7.3 Admin Incidents Page (WHS)

**Pattern:** Same DataTable pattern, but shows ALL incidents across company.

**Route:** `/admin/incidents`

**Additional columns:** Reporter Name, Team Name

**Additional filters:** Status tabs + severity filter + incident type filter + search (by title/reporter name)

**Row actions** (via `DropdownMenu` in actions column):
- View → navigate to detail page
- Approve (only if PENDING) → `ConfirmDialog`
- Reject (only if PENDING) → `RejectionDialog`

### 7.4 Incident Detail Page (Shared)

**Pattern:** 4-quadrant card layout with InfoRow components.

**Route:** `/incidents/:id` (worker) or `/admin/incidents/:id` (admin)

**Layout:**
```
PageLoader →
  Header row:
    Left: "Incident Details" title + reporter name + severity badge
    Right: status badge + back button
  2x2 Card Grid (md:grid-cols-2):
    Top-left: INCIDENT INFORMATION
      - Incident # (INC-YYYY-NNNN)
      - Status (IncidentStatusBadge)
      - Severity (SeverityBadge)
      - Incident Type
      - Created date
    Top-right: REPORTER INFORMATION
      - Name
      - Email
      - Team
      - Location
    Bottom-left: INCIDENT DETAILS
      - Title
      - Description (whitespace-pre-wrap)
    Bottom-right: WHS REVIEW
      - Reviewed By / "Pending Review"
      - Reviewed At
      - If APPROVED: Case #, Case Status (CaseStatusBadge), Case Notes (read-only), "View Full Case" button (WHS/Admin only)
      - If REJECTED: Rejection Reason, Explanation
      - If PENDING: "Pending Review" badge
  WHS/Admin Actions (if PENDING):
    Card with [Approve] [Reject] buttons
  Timeline (if events exist):
    Card with IncidentTimeline component
  Dialogs:
    ConfirmDialog (approve)
    RejectionDialog (reject)
```

**InfoRow component:** Reusable key-value row with label on left, value on right, separated by border-b.

**Case notes display:** When status is APPROVED and notes exist, they are displayed read-only in the WHS Review card. Notes are sourced from `incident.caseNotes` (mapped from `incident_case.notes` in the backend controller).

**Worker case access:** Workers see case info inline (case number, case status, notes). Workers do NOT navigate to a separate case page. Only WHS/Admin users see the "View Full Case" button that navigates to `/admin/cases/:id`.

**Authorization:** Workers can only view their own incidents (enforced backend). WHS/Admin can view all.

### 7.5 Case Detail Page (WHS/Admin Only)

**Pattern:** 4-quadrant card layout matching IncidentDetailPage, with Manage Case form below.

**Route:** `/admin/cases/:id` (WHS/Admin only — workers see case info inline on IncidentDetailPage)

**Layout:**
```
PageLoader →
  Header row:
    Left: "Case Details" title + reporter name + severity badge
    Right: case status badge + back button
  2x2 Card Grid (md:grid-cols-2):
    Top-left: CASE INFORMATION
      - Case # (CASE-YYYY-NNNN)
      - Status (CaseStatusBadge)
      - Severity (SeverityBadge)
      - Incident # (INC-YYYY-NNNN)
      - Created date
    Top-right: REPORTER INFORMATION
      - Name
      - Email
      - Team
      - Location
    Bottom-left: INCIDENT DETAILS
      - Title
      - Type
      - Description (whitespace-pre-wrap)
    Bottom-right: WHS ASSIGNMENT
      - Assigned To / "Unassigned"
      - Notes (read-only display) / "No notes yet"
  Manage Case (Card with form):
    - Status dropdown (Select with valid transitions only, disabled message if terminal)
    - Notes textarea (editable)
    - Save Changes button
  Timeline (if events exist):
    Card with IncidentTimeline component
```

**No tabs:** All information is visible on a single page without tab switching, matching the IncidentDetailPage layout for visual consistency.

**Timeline** is sourced from `Event` table where `entity_type = 'incident' AND entity_id = incidentId` (see Section 5.6). All events — incident and case — are returned in one query since they all reference the parent incident ID.

### 7.6 Rejection Dialog

**Pattern:** `Dialog` with embedded form (React Hook Form + Zod).

```typescript
const rejectIncidentSchema = z.object({
  rejectionReason: z.enum(['DUPLICATE_REPORT', 'INSUFFICIENT_INFORMATION', 'NOT_WORKPLACE_INCIDENT', 'OTHER'], {
    required_error: 'Please select a reason',
  }),
  rejectionExplanation: z.string().min(1, 'Explanation is required').max(500),
});
```

**Fields:**
- Rejection Reason — `Select` (4 options)
- Explanation — `Textarea` (required)

**On confirm:** `useRejectIncident.mutateAsync({ incidentId, data })` → Toast + close dialog

---

## 8. Query/Mutation Hook Patterns

### 8.1 Query Hooks

```typescript
// useMyIncidents.ts
// NOTE: Uses IncidentListResponse (not PaginatedResponse<Incident>) because response includes statusCounts
export function useMyIncidents(page = 1, limit = 20, status?: IncidentStatus) {
  return useQuery({
    queryKey: ['my-incidents', page, limit, status],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      return apiClient.get<IncidentListResponse>(
        `${ENDPOINTS.INCIDENT.MY}?${params.toString()}`
      );
    },
  });
}

// useIncident.ts
export function useIncident(incidentId: string) {
  return useQuery({
    queryKey: ['incident', incidentId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<Incident>(ENDPOINTS.INCIDENT.BY_ID(incidentId)),
    enabled: !!incidentId,
  });
}

// useIncidentTimeline.ts
// NOTE: Uses ENDPOINTS.INCIDENT.TIMELINE — not string concatenation with BY_ID
export function useIncidentTimeline(incidentId: string) {
  return useQuery({
    queryKey: ['incident-timeline', incidentId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<IncidentEvent[]>(
      ENDPOINTS.INCIDENT.TIMELINE(incidentId)
    ),
    enabled: !!incidentId,
  });
}
```

> **Note:** This requires a `GET /incidents/:id/timeline` endpoint on the backend that returns `Event[]` filtered by `entity_type = 'incident' AND entity_id = incidentId`.

### 8.2 Mutation Hooks

```typescript
// useCreateIncident.ts
export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIncidentData) =>
      apiClient.post<Incident>(ENDPOINTS.INCIDENT.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

// useApproveIncident.ts
// NOTE: apiClient.patch requires a body argument — pass {} for no-body PATCH requests
export function useApproveIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (incidentId: string) =>
      apiClient.patch<Incident>(ENDPOINTS.INCIDENT.APPROVE(incidentId), {}),
    onSuccess: (_, incidentId) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['my-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

// useRejectIncident.ts
export function useRejectIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, data }: { incidentId: string; data: RejectIncidentData }) =>
      apiClient.patch<Incident>(ENDPOINTS.INCIDENT.REJECT(incidentId), data),
    onSuccess: (_, { incidentId }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['my-incidents'] });
    },
  });
}
```

Toast notifications are handled in the PAGE component's `onSuccess`/`onError`, NOT inside hooks.

---

## 9. Authorization Matrix (V1)

| Action | WORKER | TEAM_LEAD | SUPERVISOR | WHS | ADMIN |
|--------|--------|-----------|------------|-----|-------|
| Submit incident | Yes | Yes | Yes | Yes | Yes |
| View own incidents | Yes | Yes | Yes | Yes | Yes |
| View own incident detail | Yes | Yes | Yes | Yes | Yes |
| View all incidents | No | No | No | Yes | Yes |
| Approve/Reject | No | No | No | Yes | Yes |
| View case (via own incident) | Read-only | Read-only | Read-only | Full | Full |
| View all cases | No | No | No | Yes | Yes |
| Update case | No | No | No | Yes | Yes |
| Assign case | No | No | No | Yes | Yes |

**V1 scope:** Team Lead/Supervisor team-level incident visibility is out of scope. All non-admin roles can only see their own incidents. This can be extended later following the `getTeamContext()` pattern from `missed-check-in.controller.ts`.

**Backend enforcement:**
- `GET /incidents/my` — filters by `reporter_id = userId` (all roles)
- `GET /incidents/:id` — checks `userId === incident.reporter_id` OR `userRole === 'ADMIN'`
- `GET /incidents` — `ADMIN` only, scoped by `company_id`
- `GET /cases/:id` — checks `userId === incident.reporter_id` (via joined incident) OR `userRole === 'ADMIN'`

**Worker case access:** Workers do NOT have a separate case page route. When an incident is approved, the `GET /incidents/:id` response includes `caseId` and `caseNumber`. The `IncidentDetailPage` renders case info inline (case number, case status, assigned officer) in the "Review Details" card. This avoids a separate `/cases/:id` worker route and keeps the access model simple.

---

## 10. Navigation Integration

### 10.1 Worker Dashboard

Add to the existing Worker Dashboard component:
- "Report Incident" button in Quick Actions section → navigates to `ROUTES.REPORT_INCIDENT`
- "My Incidents" summary card showing status counts → navigates to `ROUTES.MY_INCIDENTS`

### 10.2 Sidebar

Add to existing sidebar navigation in `components/layout/Sidebar.tsx` (`getNavItems` function):
- **Worker section:** Add `{ label: 'Incidents', icon: <AlertTriangle />, href: ROUTES.MY_INCIDENTS }` to the WORKER array
- **Admin section:** Add `{ label: 'Incidents', icon: <AlertTriangle />, href: ROUTES.ADMIN_INCIDENTS }` to the ADMIN array

**Mobile limitation:** The mobile bottom nav (`Sidebar.tsx:218`) only shows `navItems.slice(0, 4)` + Settings. The WORKER nav currently has 4 items (Dashboard, Check-In, History, Schedule). Adding "Incidents" makes 5 — the 5th item won't appear on mobile. Two options:
1. Replace "Schedule" with "Incidents" in the mobile slice (if incidents are higher priority)
2. Increase the mobile nav to show 5 items (adjust `slice(0, 5)` and layout spacing)

**Note:** Admin nav is 6+ items — mobile already only shows first 4. Admin incident management is primarily a desktop workflow, so this is acceptable.

### 10.3 Frontend NotificationType Update

The frontend `src/types/common.types.ts` defines `NotificationType` which must be extended to match the new backend enum values:

```typescript
// Add to existing NotificationType in common.types.ts
export type NotificationType =
  | 'CHECK_IN_REMINDER'
  | 'MISSED_CHECK_IN'
  | 'TEAM_ALERT'
  | 'SYSTEM'
  | 'INCIDENT_SUBMITTED'
  | 'INCIDENT_APPROVED'
  | 'INCIDENT_REJECTED';
```

---

## 11. Business Rules

### 11.1 Submission Rules
- Any authenticated user can submit an incident
- Required fields: `incidentType`, `severity`, `title`, `description`
- Optional field: `location`
- Incident number generated in service layer per company (not global autoincrement)
- Initial status: `PENDING`
- Reporter cannot approve/reject their own incident (enforced: only ADMIN can approve/reject)

### 11.2 Review Rules
- Only `ADMIN` and `WHS` roles can approve or reject
- Can only approve/reject incidents with status `PENDING`
- Rejection requires both `rejectionReason` (enum) and `rejectionExplanation` (free text)
- Approval creates a Case record in the same database transaction
- Status transitions are terminal: APPROVED and REJECTED cannot be changed
- The reviewer's name is recorded (`reviewed_by`) and displayed on list tables and detail pages

### 11.3 Case Rules
- Cases are only created via incident approval (no direct case creation endpoint)
- Case number generated in service layer per company (same pattern as incident number)
- Case status flow: `OPEN` -> `INVESTIGATING` -> `RESOLVED` -> `CLOSED`
- Only ADMIN and WHS can update case status, assign officers, add notes
- Workers see case info inline on IncidentDetailPage (no separate worker case route)
- Case notes are readable from both CaseDetailPage (editable) and IncidentDetailPage (read-only via `caseNotes` field)

### 11.4 Notification Rules
- In-app notification only (existing system — no email/SMS)
- On submission: notify ALL active WHS and ADMIN users in the company via `NotificationRepository.createMany()` (type: `INCIDENT_SUBMITTED`)
- On approval: notify reporter with incident number + case number (type: `INCIDENT_APPROVED`)
- On rejection: notify reporter with incident number + rejection reason (type: `INCIDENT_REJECTED`)
- All notifications are fire-and-forget (wrapped in try/catch, never block main operation)
- Notifications use existing polling mechanism (30s interval)

### 11.5 History Rules
- All incidents persist regardless of status (no deletion)
- Workers see only their own incidents
- Admins see all incidents for their company (multi-tenant scoped)
- Status tab counts provided by `statusCounts` in API response

---

## 12. Complete Flow Diagram

```
WORKER                              SYSTEM                              ADMIN (WHS)
  │                                   │                                   │
  │ Click [Report Incident]           │                                   │
  │──────────────────────────────────>│                                   │
  │                                   │                                   │
  │ Fill form + Submit                │                                   │
  │──────────────────────────────────>│                                   │
  │                                   │ POST /incidents                   │
  │                                   │ ─ Validate (Zod)                  │
  │                                   │ ─ Create Incident (PENDING)       │
  │                                   │ ─ Create Event (INCIDENT_CREATED) │
  │                                   │ ─ Create AuditLog                 │
  │                                   │ ─ Notify WHS+ADMIN users ────────>│
  │                                   │                                   │
  │ Toast + Redirect to My Incidents  │                                   │
  │<──────────────────────────────────│                                   │
  │                                   │                                   │
  │                                   │ GET /incidents?status=PENDING     │
  │                                   │<──────────────────────────────────│
  │                                   │ Return paginated list             │
  │                                   │──────────────────────────────────>│
  │                                   │                                   │
  │                                   │                     Review + Decide
  │                                   │                                   │
  │                        ┌──────────┴──────────┐                        │
  │                        │                     │                        │
  │              APPROVE PATH            REJECT PATH                      │
  │                        │                     │                        │
  │            PATCH /:id/approve    PATCH /:id/reject                    │
  │                        │                     │                        │
  │              $transaction:          Update incident:                   │
  │              ─ status=APPROVED      ─ status=REJECTED                 │
  │              ─ Create Case          ─ rejection_reason                │
  │              ─ Event                ─ rejection_explanation           │
  │              ─ Notification         ─ Event                          │
  │              ─ AuditLog             ─ Notification                   │
  │                        │            ─ AuditLog                       │
  │                        │                     │                        │
  │<───────── Notification ┴──── Notification ──>│                        │
  │                                   │                                   │
  │ View My Incidents                 │                                   │
  │ (APPROVED tab or REJECTED tab)    │                                   │
  │──────────────────────────────────>│                                   │
  │                                   │                                   │
  │ Click incident row                │                                   │
  │ → Incident Detail (read-only)     │                                   │
  │ → If approved: case info inline   │                                   │
  │ → If rejected: see reason         │                                   │
```

---

## 13. Implementation Order

### Phase 1: Backend Foundation
1. Add Prisma schema (enums + Incident model + Case model + relation updates + extend EventType + NotificationType)
2. Run migration (`npm run db:migrate`)
3. Create `incident` backend module (routes, controller, service with retry logic, repository extending BaseRepository, validator)
4. Create `case` backend module (routes, controller, service with status transitions, repository, validator)
5. Register routes in backend `app.ts`: `api.route('/incidents', incidentRoutes)` and `api.route('/cases', caseRoutes)`
6. Use `logAudit()` from `shared/audit.ts` (with `companyId` + `personId` params)
7. Use `NotificationRepository` directly for fire-and-forget notifications (with try/catch)
8. **Avoid `case` as variable name** — use `incidentCase` or `caseRecord` throughout (reserved word)

### Phase 2: Frontend Foundation
9. Add types to `src/types/incident.types.ts` (including `IncidentListResponse` for statusCounts)
10. Update `NotificationType` in `src/types/common.types.ts` (add `INCIDENT_SUBMITTED`, `INCIDENT_APPROVED`, `INCIDENT_REJECTED`)
11. Add endpoints to `src/lib/api/endpoints.ts` (INCIDENT + CASE sections)
12. Add routes to `src/config/routes.config.ts`
13. Create query/mutation hooks in `src/features/incident/hooks/`

### Phase 3: Worker Pages
14. `ReportIncidentPage` (form with Zod validation)
15. `MyIncidentsPage` (DataTable + status tabs using `IncidentListResponse`)
16. `IncidentDetailPage` (read-only for workers, with inline case info when approved)
17. Badge components: `IncidentStatusBadge`, `SeverityBadge`, `CaseStatusBadge`

### Phase 4: Admin Pages
18. `AdminIncidentsPage` (DataTable with filters + approve/reject actions)
19. `RejectionDialog` component (Dialog + React Hook Form + Zod)
20. `AdminCasesPage` (DataTable of all cases with status filters)
21. `CaseDetailPage` (detail + timeline + admin actions)
22. `IncidentTimeline` component (shared between detail pages)

### Phase 5: Integration
23. Register routes in `src/routes/index.tsx` — add INSIDE existing guard structure (not separate guards)
24. Add sidebar navigation links (handle mobile 4-item limit for workers)
25. Add worker dashboard incident summary card + "Report Incident" quick action
26. Lazy-load all new page components (matching existing `React.lazy()` pattern)
27. Test end-to-end flow: submit → view in pending → approve/reject → notification → status update

---

## 14. Out of Scope (V1)

These are explicitly NOT included in the initial implementation:

- File attachments (photos/documents) — can be added later using existing R2 infrastructure
- Email/SMS notifications — current system is in-app only
- Incident editing after submission — incidents are immutable once submitted
- Appeal/resubmission workflow — worker submits a new incident instead
- Auto-escalation for stale pending incidents — no cron job in V1
- Team Lead/Supervisor incident management — they get read-only view of team incidents only
