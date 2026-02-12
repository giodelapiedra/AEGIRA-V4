AEGIRA V5 - Professional System Analysis
1. Main Function and Purpose
AEGIRA is a multi-tenant workforce readiness and health management system designed to monitor and improve worker safety, wellness, and operational readiness in organizations with shift-based or team-based work environments.
The system's core purpose is to:
•	Track daily worker wellness through standardized check-ins (sleep quality, stress levels, physical condition, pain)
•	Calculate readiness scores to identify workers who may be at risk of injury or poor performance
•	Detect and manage missed check-ins automatically to ensure compliance
•	Report and manage workplace health incidents through a structured incident and case management system
•	Provide role-specific dashboards for workers, team leaders, supervisors, WHS officers, and administrators
________________________________________
2. How the System Works
User Perspective
For Workers:
1.	Log in daily during their team's designated check-in window (e.g., 6:00 AM - 10:00 AM)
2.	Complete a 2-minute wellness check-in by answering questions about:
o	Hours slept
o	Sleep quality (1-10)
o	Stress level (1-10)
o	Physical condition (1-10)
o	Pain level and location (if applicable)
3.	Receive an instant readiness score (0-100) with color-coded status:
o	GREEN: Ready for work (75-100)
o	YELLOW: Modified duty recommended (50-74)
o	RED: Needs attention/unfit for work (<50)
4.	View their personal dashboard showing:
o	Current check-in streak
o	Average readiness over time
o	Completion rate
o	Weekly readiness trend
5.	Report workplace incidents directly through the app
For Team Leaders:
1.	Monitor their team's daily check-in compliance in real-time
2.	See which workers have checked in, who's pending, and who missed
3.	View team average readiness and identify workers needing attention
4.	Receive notifications about missed check-ins
5.	Access historical team analytics and reports
For Supervisors:
1.	Oversee multiple teams across the organization
2.	View company-wide compliance rates and readiness trends
3.	Monitor team leaders' performance
4.	Identify systemic issues across teams
For WHS (Workplace Health & Safety) Officers:
1.	Monitor all workers' readiness levels in real-time
2.	Analyze historical trends (7-day, 30-day, 90-day periods)
3.	Review and approve/reject incident reports
4.	Convert approved incidents into formal cases for investigation
5.	Track case resolution and maintain compliance records
For Administrators:
1.	Manage company settings, teams, and users
2.	Configure work schedules, holidays, and check-in windows
3.	Access comprehensive audit logs
4.	Monitor system health and user activity
Business Perspective
Data Flow:
1.	Daily at 6:00 AM: Workers receive check-in reminders (if enabled)
2.	During check-in window: Workers submit wellness data → System calculates readiness scores → Data stored with event sourcing
3.	After check-in window closes + 2-minute buffer: Automated job detects missed check-ins → Creates records with contextual snapshots → Sends notifications
4.	Throughout the day: Team leaders and supervisors monitor compliance and readiness
5.	Incident occurs: Worker reports → WHS reviews → Approves/Rejects → Creates case → Assigns investigator → Resolves
6.	End of day: System runs cleanup jobs, generates notifications
Key Technical Features:
•	Multi-tenant architecture: Each company operates in complete isolation with their own data
•	Timezone support: All dates/times calculated in company's configured timezone (default: Asia/Manila)
•	Event sourcing: Every state change is recorded as an event for full audit trail
•	Automated compliance tracking: No manual work required to detect missed check-ins
•	Role-based access control: 5 distinct roles with appropriate permissions
•	Holiday support: Automatically excludes company holidays from compliance calculations
________________________________________
3. Key Features and Tools
Core Features
1. Daily Check-In System
•	Configurable check-in windows per team
•	Automatic readiness score calculation using proprietary algorithm
•	Component scores: sleep (0-100), stress (0-100), physical (0-100), pain (0-100)
•	Check-in history with amendment request capability
•	Mobile-responsive interface for on-the-go check-ins
2. Missed Check-In Detection (Automated)
•	Runs every 15 minutes via background job
•	Detects workers who missed check-in after window closes
•	Captures contextual state snapshot at time of miss:
o	Days since last check-in
o	Days since last miss
o	Recent readiness average (7 days)
o	Misses in last 30/60/90 days
o	Team leader at time of miss
o	Baseline completion rate
•	Pattern indicators (first miss in 30 days, increasing frequency)
•	Automatic notification to worker and team lead
•	Excludes holidays and non-work days
•	Respects team assignment date (workers assigned today are not penalized)
3. Team Management
•	Create teams with leaders and supervisors
•	Configure work schedules (days of week, check-in windows)
•	Assign workers to teams
•	Real-time team dashboard showing:
o	Today's submissions vs expected
o	Pending/missed check-ins
o	Team average readiness
o	Member statuses with readiness categories
•	Team analytics with historical trends
4. Incident Reporting & Case Management
•	Workers can report incidents with:
o	Type (physical injury, illness, mental health, medical emergency, safety concern, other)
o	Severity (low, medium, high, critical)
o	Location, description, title
•	Sequential incident numbers per company (e.g., #INC-001, #INC-002)
•	WHS review workflow: Pending → Approved/Rejected
•	Approved incidents automatically create cases with case numbers (#CASE-001)
•	Case assignment to investigators
•	Case status tracking: Open → Investigating → Resolved → Closed
•	Full audit trail of incident lifecycle
5. Role-Specific Dashboards
•	Worker Dashboard: Personal readiness stats, check-in streak, schedule
•	Team Lead Dashboard: Team compliance, member statuses, avg readiness
•	Supervisor Dashboard: Multi-team overview, compliance rates across teams
•	WHS Dashboard: Company-wide readiness distribution, incident queue, case workload
•	Admin Dashboard: System stats, user counts, audit logs
6. WHS Analytics (Charts & Trends)
•	Period selector: 7-day, 30-day, 90-day views
•	Readiness trend over time (area chart)
•	Check-in compliance trends
•	Readiness level distribution (pie charts)
•	Incident type breakdown
•	Severity distribution
•	Centralized color configuration for consistent branding
7. Notification System
•	Real-time in-app notifications
•	Types: Check-in reminders, missed check-ins, team alerts, incident updates
•	Read/unread tracking
•	Notification history
8. Audit & Compliance
•	Full audit log: who did what, when, from which IP
•	Event sourcing: complete history of all check-ins, updates, amendments
•	Amendment workflow: Workers can request changes to past check-ins (requires approval)
•	Holiday management: Configure company holidays (one-time or recurring)
9. Advanced Features
•	State Snapshots: Missed check-ins capture 13 contextual metrics for analytics
•	Fire-and-forget operations: Audit logs and notifications never block main operations
•	Parallel query optimization: Uses Promise.all() and groupBy to minimize database queries
•	Pagination: All list endpoints support server-side pagination
•	Form validation: Client and server-side validation using Zod schemas
________________________________________
4. Benefits for Companies and Organizations
Operational Benefits
1.	Proactive Risk Management: Identify at-risk workers BEFORE incidents occur (not after)
2.	Reduced Workplace Injuries: Workers with low readiness scores can be assigned modified duties
3.	Compliance Automation: No manual tracking of who checked in - system does it automatically
4.	Data-Driven Decisions: Historical trends reveal patterns (e.g., Mondays = lower readiness, certain teams = higher incidents)
5.	Improved Accountability: Clear visibility into team leader performance and worker compliance
Health & Safety Benefits
1.	Early Warning System: Catch fatigue, stress, and pain issues before they escalate
2.	Incident Documentation: Structured incident reporting ensures nothing falls through cracks
3.	Case Management: Track investigations from start to finish with audit trail
4.	Wellness Tracking: Monitor worker wellness trends over weeks/months
5.	Holiday Awareness: System automatically excludes holidays from compliance calculations
Management Benefits
1.	Real-Time Visibility: Managers know team readiness status within seconds
2.	Centralized Platform: One system for check-ins, incidents, teams, schedules
3.	Role-Based Access: Each user sees only what's relevant to their role
4.	Mobile-First: Workers can check in from anywhere on any device
5.	Multi-Tenant: One installation serves multiple companies in complete isolation
Compliance & Legal Benefits
1.	Complete Audit Trail: Every action logged with timestamp, user, IP address
2.	Event Sourcing: Full history of all check-ins and changes (immutable)
3.	Amendment Workflow: Transparent process for correcting check-in data
4.	Incident Records: Structured documentation for legal/insurance purposes
5.	Timezone Support: Accurate date/time tracking in company's local timezone
Cost Benefits
1.	Reduced Incidents: Fewer workplace injuries = lower insurance premiums
2.	Improved Productivity: Workers with good readiness perform better
3.	Automation: Eliminates manual compliance tracking (saves hours per week)
4.	Scalability: Handles 10 teams or 1000 teams with same efficiency
5.	Preventive vs Reactive: Cheaper to prevent incidents than manage them
________________________________________
5. Target Industries and Organizations
Primary Industries
1. Construction & Infrastructure
•	High physical demands
•	Heavy machinery operation
•	Safety-critical work environments
•	Shift-based schedules
•	Team-based operations
•	Why AEGIRA fits: Physical condition monitoring crucial for preventing injuries
2. Mining & Resources
•	Remote work sites
•	Rotating shift schedules
•	Physically demanding roles
•	High safety risks
•	Fatigue management required by regulation
•	Why AEGIRA fits: Sleep tracking and fatigue detection prevent accidents
3. Manufacturing & Warehousing
•	Repetitive physical tasks
•	Machinery operation
•	Shift work (24/7 operations)
•	Team-based production lines
•	Why AEGIRA fits: Stress and physical condition monitoring reduces repetitive strain injuries
4. Transportation & Logistics
•	Truck drivers, forklift operators
•	Long shifts, irregular schedules
•	Safety-critical operations
•	Fatigue management legally required
•	Why AEGIRA fits: Sleep and stress monitoring ensures driver alertness
5. Healthcare & Aged Care
•	Physically and emotionally demanding
•	Shift work (day/night rotation)
•	High burnout rates
•	Patient safety depends on staff wellness
•	Why AEGIRA fits: Stress and mental health monitoring prevents burnout
6. Emergency Services
•	Police, fire, paramedics
•	High-stress environments
•	Irregular hours, on-call work
•	Physical and mental demands
•	Why AEGIRA fits: Comprehensive wellness tracking ensures responder readiness
Secondary Industries
7. Hospitality & Events
•	Long shifts, weekend work
•	Physically active roles
•	High stress during peak periods
•	Team-based service delivery
8. Agriculture & Farming
•	Seasonal workers
•	Physically demanding tasks
•	Early morning shifts
•	Weather-dependent schedules
9. Security & Facilities Management
•	Shift-based coverage (24/7)
•	Standing/walking for extended periods
•	Night shift workers
•	Team-based patrol operations
Organization Characteristics
AEGIRA is ideal for organizations with:
•	20-5000+ employees (scalable architecture)
•	Team-based structure (not individual contributors)
•	Safety-critical operations (where worker wellness impacts safety)
•	Shift-based schedules (especially early morning shifts)
•	Regulatory compliance requirements (OH&S, fatigue management)
•	Multi-site operations (with timezone support)
•	Need for incident tracking (workplace health & safety)
________________________________________
6. System Strengths
Technical Strengths
1. Modern, Scalable Architecture
•	Monorepo structure (backend + frontend)
•	PostgreSQL database with Prisma ORM (type-safe queries)
•	React frontend with TanStack Query (optimized caching)
•	Event sourcing pattern (immutable audit trail)
•	Multi-tenant isolation at database level
•	RESTful API with Hono framework (high performance)
2. Performance Optimization
•	Parallel database queries using Promise.all()
•	Efficient groupBy queries instead of N+1 patterns
•	Server-side pagination on all list endpoints
•	TanStack Query caching reduces API calls
•	Lazy-loaded React routes reduce initial bundle size
•	Optimized Prisma queries (select only needed fields)
3. Security & Compliance
•	Multi-tenant isolation (company_id filtering on every query)
•	JWT authentication with httpOnly cookies (XSS protection)
•	Role-based access control (5 distinct roles)
•	Bcrypt password hashing (12 rounds)
•	Audit logging on all critical operations
•	Input validation on client and server (Zod schemas)
4. User Experience
•	Mobile-responsive design (Tailwind CSS)
•	Real-time notifications
•	Intuitive role-specific dashboards
•	Color-coded readiness levels (green/yellow/red)
•	Skeleton loading states (no blank screens)
•	Form validation with helpful error messages
5. Automation & Reliability
•	Automated missed check-in detection (runs every 15 minutes)
•	Background jobs via node-cron (daily reminders, cleanup)
•	Fire-and-forget audit logging (never blocks operations)
•	Idempotent operations (safe to retry)
•	In-memory job locks (prevents duplicate runs)
•	Comprehensive error handling
6. Developer Experience
•	TypeScript everywhere (100% type safety)
•	Consistent code patterns (CLAUDE.md guidelines)
•	Modular architecture (features as modules)
•	Comprehensive inline documentation
•	Zod schemas generate TypeScript types automatically
•	Shared utilities reduce code duplication
7. Data Intelligence
•	State snapshots on missed check-ins (13 contextual metrics)
•	Pattern detection (first miss, increasing frequency)
•	Historical trend analysis (7/30/90-day periods)
•	Readiness score algorithm with component breakdown
•	Completion rate accounting for holidays and assignment date
________________________________________
7. Weaknesses and Limitations
Current Limitations
1. Notification Delivery
•	In-app only - no SMS, email, or push notifications
•	Workers must be logged in to see notifications
•	Missed check-in reminders may not reach workers if they don't open the app
•	Impact: Lower engagement, missed reminders
•	Workaround: Team leaders can manually contact workers
2. Readiness Score Algorithm
•	Proprietary formula not validated by medical professionals
•	No integration with wearable devices (Fitbit, Apple Watch) for objective sleep data
•	Relies on self-reported data (can be inaccurate)
•	No benchmark for "normal" readiness by industry or role
•	Impact: Scores may not accurately predict incident risk
•	Workaround: Use scores as indicators, not absolutes
3. Mobile Experience
•	Responsive web app but no native mobile apps (iOS/Android)
•	No offline mode (requires internet connection)
•	Cannot use device features (push notifications, biometric login)
•	Impact: Less convenient for field workers with poor connectivity
•	Workaround: Workers can use mobile browsers
4. Reporting & Analytics
•	No export to CSV/Excel for reports
•	No custom report builder (fixed dashboards only)
•	Limited time range options (7/30/90 days, no custom date ranges)
•	No integration with BI tools (Power BI, Tableau)
•	Impact: Organizations with advanced analytics needs may find it limiting
•	Workaround: Use audit logs for custom analysis (requires technical skills)
5. Incident Management
•	No file upload support (photos of injuries, incident scenes)
•	No linking multiple workers to one incident (e.g., mass injury event)
•	No integration with workers' compensation systems
•	Case management is basic (status tracking only, no workflow automation)
•	Impact: May need separate system for complex incident investigations
•	Workaround: Store files externally, reference in notes
6. Team Structure
•	Single team per worker - no support for workers on multiple teams
•	No hierarchical teams (sub-teams, departments)
•	No shift-level scheduling (everyone on team has same check-in window)
•	Impact: Doesn't fit organizations with matrix structures or rotating shifts
•	Workaround: Create separate teams for each shift
7. Scalability Considerations
•	In-memory job locks - won't work in multi-instance deployments (needs Redis)
•	No database read replicas (all queries hit primary)
•	No caching layer (Redis/Memcached) for frequently accessed data
•	Impact: Performance may degrade beyond 10,000+ daily check-ins
•	Workaround: Works fine for 95% of target customers (<5000 workers)
8. Internationalization
•	English only - no multi-language support
•	Timezone support is good but no locale-specific date formats
•	Impact: Not suitable for non-English speaking workforces
•	Workaround: Add translations manually (requires code changes)
________________________________________
8. Suggestions for Improvement
High Priority (Critical for Market Fit)
1. Multi-Channel Notifications
•	Add SMS notifications for missed check-ins (via Twilio/AWS SNS)
•	Add email notifications for incident approvals/rejections
•	Add push notifications for mobile browsers (Web Push API)
•	Benefit: Workers actually receive reminders, improving compliance
2. Mobile Native Apps
•	Build iOS and Android apps (React Native for code sharing)
•	Support offline check-in (submit when connectivity restored)
•	Use device biometric authentication (fingerprint, face ID)
•	Enable camera integration for incident photos
•	Benefit: Better user experience, works in remote locations
3. File Upload & Attachments
•	Allow file uploads on incidents (photos, documents)
•	Store in Cloudflare R2 (S3-compatible storage already configured)
•	Support multiple files per incident/case
•	Benefit: Complete incident documentation in one place
4. Export & Reporting
•	CSV/Excel export on all data tables
•	Custom date range selector (not just 7/30/90 days)
•	Scheduled reports (weekly compliance email to supervisors)
•	PDF export for incident reports
•	Benefit: Meets compliance documentation requirements
Medium Priority (Improves Usability)
5. Enhanced Readiness Algorithm
•	Partner with occupational health experts to validate scoring
•	Add industry-specific weightings (construction vs healthcare)
•	Integrate with wearable devices (Fitbit, Garmin) for objective sleep data
•	Machine learning to predict incident risk based on historical patterns
•	Benefit: More accurate risk assessment, better ROI
6. Shift Management
•	Support multiple shifts per team (morning/evening/night)
•	Different check-in windows per shift
•	Shift rotation scheduling
•	Worker assignment to specific shifts
•	Benefit: Fits 24/7 operations better
7. Advanced Team Structure
•	Allow workers on multiple teams
•	Hierarchical teams (department → team → sub-team)
•	Cross-functional teams
•	Temporary team assignments (projects)
•	Benefit: Supports complex organizational structures
8. Workflow Automation
•	Auto-escalation: Missed check-in for 3 consecutive days → notify supervisor
•	Case SLA tracking: Cases open >30 days → auto-flag
•	Scheduled check-ins: Auto-close check-in window at designated time
•	Conditional notifications: Low readiness + high pain → alert WHS
•	Benefit: Reduces manual monitoring burden
Lower Priority (Nice to Have)
9. Internationalization (i18n)
•	Multi-language support (Spanish, Tagalog, Mandarin)
•	Locale-specific date/time formats
•	Translation management interface
•	Benefit: Expands addressable market
10. Integration APIs
•	REST API for third-party integrations
•	Webhook support (incident created → trigger external system)
•	HRIS integration (sync workers from Workday, BambooHR)
•	Workers' comp integration (auto-submit incidents)
•	Benefit: Fits into existing tech stack
11. Advanced Analytics
•	Predictive analytics (forecast incident risk by team)
•	Correlation analysis (sleep hours vs readiness)
•	Benchmarking (compare to industry averages)
•	Custom dashboards (drag-and-drop widgets)
•	Benefit: Data-driven workforce optimization
12. Gamification
•	Leaderboards (team with best compliance)
•	Badges/achievements (30-day streak, 100% completion)
•	Wellness challenges (team competitions)
•	Benefit: Improves engagement and compliance
________________________________________
Summary
AEGIRA V5 is a comprehensive workforce readiness and health management platform designed for safety-critical, team-based organizations. It combines daily wellness check-ins, automated compliance tracking, incident management, and role-specific analytics into a unified system.
Ideal for: Construction, mining, manufacturing, transportation, healthcare, and emergency services organizations with 20-5000+ employees.
Key Strengths: Modern architecture, automation, multi-tenant support, role-based dashboards, comprehensive audit trail, performance optimization.
Current Gaps: Limited to web interface, no multi-channel notifications, basic reporting, single team per worker.

________________________________________
9. WHS Dashboard & Analytics — Code Review
________________________________________

Review Date: 2026-02-11
Scope: WHS Operational Dashboard, WHS Analytics Page, Backend Services, Frontend Components
Files Reviewed: 25+ files across backend and frontend

________________________________________

9.1 Validate Current System Flow
________________________________________

The WHS feature set consists of two main pages:

1. WHS Dashboard (Operational) — `/dashboard` (role-routed via `Dashboard.tsx`)
   - 4 StatCards: Pending Incidents, My Open Cases, Total Open Cases, Resolved This Month
   - Pending Incidents Table: Top 5 sorted by severity, with inline approve/reject
   - Cases by Status: Clickable breakdown (OPEN/INVESTIGATING/RESOLVED/CLOSED)
   - Recent Activity: Last 10 incident/case events with color-coded dots

2. WHS Analytics (Historical) — `/whs-analytics`
   - Period selector: 7d / 30d / 90d
   - Incident Trend area chart (approved/rejected/pending stacked + total line)
   - Incidents by Type donut chart
   - 6 summary StatCards (total, cases, approval/rejection rates, avg response/resolution)
   - Severity Distribution donut chart
   - Rejection Analysis donut chart
   - Incidents by Team table with severity breakdown

Flow Confirmation:
- Dashboard router (`Dashboard.tsx:22`) correctly routes `case 'WHS'` to `<WhsDashboard />` — the critical gap from the audit is FIXED
- Single-endpoint pattern followed for both pages (one hook, one loading state)
- All components are presentational (receive data as props, no internal fetching) — CORRECT
- Cache invalidation on `['dashboard']` prefix added to `useApproveIncident`, `useRejectIncident`, `useUpdateCase`, `useCreateIncident` — CORRECT
- Multi-tenant isolation: Both backend services use `company_id` filtering on all queries — CORRECT

Verdict: The intended flow works as designed. The critical dashboard router gap is resolved.

________________________________________

9.2 Bug & Logic Review — Critical (Must Fix)
________________________________________

BUG 1: Missed Check-In Detector — Prisma Client Out of Sync

Location: `aegira-backend/src/jobs/missed-check-in-detector.ts`
Evidence: `docs/features/whs-dashboard/missed.md` (error logs)

The `worker_role_at_miss` field exists in `schema.prisma` (line 189) but the Prisma Client does not recognize it at runtime. The error log shows:

  `Unknown argument 'worker_role_at_miss'. Available options are marked with ?.`

This causes `prisma.missedCheckIn.createMany()` to throw `PrismaClientValidationError` for EVERY company, meaning ALL missed check-in detection is silently failing. The job reports `totalDetected: 0` even when workers genuinely missed check-ins.

Root cause: `schema.prisma` is modified (git status shows `M aegira-backend/prisma/schema.prisma`) but either:
  (a) The migration was not created/applied (`npm run db:migrate`), or
  (b) The Prisma Client was not regenerated (`npm run db:generate`)

Impact: Critical — the core compliance feature (automated missed check-in detection with state snapshots) is completely broken. Workers who miss check-ins are not being recorded, no notifications are being sent, and team leaders have no visibility.

Fix:
  1. Run `npm run db:migrate` in `aegira-backend/` to create and apply the migration
  2. Run `npm run db:generate` in `aegira-backend/` to regenerate the Prisma Client
  3. Restart the backend server
  4. Verify by checking logs on next cron cycle

________________________________________

BUG 2: WHS Analytics Route — Inconsistent Access Control

Location: `aegira-backend/src/modules/dashboard/dashboard.routes.ts:43`

The WHS Analytics route uses `whsOnly` (line 43):
  `router.get('/whs-analytics', whsOnly, controller.getWhsAnalytics);`

But `whsOnly` is defined as `roleMiddleware(['WHS'])` (line 19), which means ADMIN users cannot access WHS Analytics.

Meanwhile:
  - The WHS Dashboard route (`/whs`) correctly uses `whsAccess` (WHS + ADMIN)
  - The design doc `WHS_ANALYTICS_PLAN.md` line 1 says: "Access: WHS + ADMIN"
  - The frontend `routes/index.tsx:280` also restricts to `['WHS']` only

The ADMIN sidebar also does not include an Analytics link (Sidebar.tsx lines 156-199), so even if the backend was fixed, the ADMIN role would have no navigation to the analytics page.

This may be intentional (WHS-exclusive analytics) or an oversight. Clarification needed from product owner.

Impact: Medium — ADMIN users cannot view WHS analytics. If intentional, document it. If not, change `whsOnly` to `whsAccess` on line 43 and add the analytics nav item to the ADMIN sidebar.

________________________________________

BUG 3: Activity Feed — Broken Action URLs for All Incident Events

Location: `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts:60-84` (`buildActionUrl()`)
Cross-ref: `aegira-backend/src/modules/incident/incident.service.ts:97-103, 220-224, 344-348` (event payloads)

The `buildActionUrl()` function expects `payload.incidentId` to generate clickable links for incident events:
```
  const incidentId = payload.incidentId || payload.incident_id;
  if (incidentId && (eventType === 'INCIDENT_CREATED' || ...)) {
    return `/admin/incidents/${String(incidentId)}`;
  }
```

However, NONE of the 3 incident event types include `incidentId` in their payload:

  INCIDENT_CREATED payload:  `{ incidentNumber, incidentType, severity, title }`         — NO incidentId
  INCIDENT_APPROVED payload: `{ incidentNumber, caseId, caseNumber }`                    — NO incidentId
  INCIDENT_REJECTED payload: `{ incidentNumber, rejectionReason, rejectionExplanation }` — NO incidentId

The incident ID IS stored in `entity_id` (the Event model field), but `buildActionUrl()` only checks `payload.incidentId` — it never reads `entity_id`.

Result: All incident events in the Recent Activity feed have `actionUrl: undefined`. The frontend `RecentActivity.tsx` renders these as non-clickable text. Case events (CASE_CREATED, CASE_UPDATED, CASE_RESOLVED) work correctly because `case.service.ts` DOES include `caseId` in the payload.

Impact: Medium — activity feed shows incident events but they are not navigable. Users cannot click on "John reported Near Miss (MEDIUM)" to go to the incident detail page.

Fix (choose one):
  (a) Add `incidentId` to all 3 incident event payloads in `incident.service.ts` (e.g., `incidentId: created.id` for CREATED, `incidentId: incidentId` for APPROVED/REJECTED), OR
  (b) Modify `buildActionUrl()` to accept `entity_id` as a parameter and use it as fallback: `const incidentId = payload.incidentId || entity_id`

Note: The `formatEventMessage()` function works correctly — its payload keys (incidentType, severity, incidentNumber, rejectionReason, caseNumber) all match the event payloads. Only `buildActionUrl()` is affected.

Additional note on INCIDENT_APPROVED specifically: This event's payload includes `caseId` and `caseNumber`, but `buildActionUrl()` only maps `caseId` to URLs for `CASE_*` event types — not `INCIDENT_APPROVED`. So even though a `caseId` exists in the payload, the URL branch doesn't match. The activity event "John approved Incident #INC-2026-0042 — Case #CSE-2026-0018 created" is not clickable at all. It should ideally link to either the incident or the newly created case. Fix (a) solves this by adding `incidentId`; alternatively, `buildActionUrl()` could also check `caseId` for `INCIDENT_APPROVED` as a secondary link target.

________________________________________

9.3 Code Quality Review
________________________________________

ISSUE 1: IncidentTrendChart — Double-Rendering of Total

Location: `aegira-frontend/src/features/dashboard/components/whs-analytics/IncidentTrendChart.tsx:91-123`

The chart renders three stacked areas (approved, rejected, pending) with `stackId="status"`, then renders a fourth non-stacked `total` area on top. Since approved + rejected + pending = total, the data is rendered twice:
  - Once as the stacked sum (bottom layer)
  - Once as the total line (top layer, with gradient fill)

This creates visual overlap. The stacked fill visually inflates to ~2x the actual values because the gradient from the `total` area sits on top of the stacked areas.

Recommendation: Either:
  (a) Remove the `total` Area and keep only the stacked areas (approved + rejected + pending), OR
  (b) Remove `stackId` from the status areas and keep only the `total` Area as an overlay with the three status areas as independent lines (no fill)

________________________________________

ISSUE 2: Pending Incidents — In-Memory Sort with Over-Fetch

Location: `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts:152-167`

The service fetches `take: 20` PENDING incidents ordered by `created_at ASC`, then sorts by severity in-memory, then takes 5. This approach:
  - Fetches more rows than needed from the database
  - Could miss the highest-severity incidents if there are >20 pending

For the current scale (likely <100 pending incidents per company), this is acceptable. However, if a company accumulates many pending incidents (e.g., after a holiday week), the top-5 CRITICAL incidents might not be in the first 20 by date.

Recommendation (optional): Use raw SQL with `ORDER BY CASE severity ... DESC, created_at ASC LIMIT 5` to get exact top-5 from PostgreSQL directly.

________________________________________

9.4 Feature Gaps (Only If Essential)
________________________________________

GAP 1: WHS Dashboard Has No Link to WHS Analytics

The WHS Dashboard page (`WhsDashboard.tsx`) does not have a visible link or button to navigate to the Analytics page. The only way to reach it is via the sidebar "Analytics" link. Adding a "View Analytics" link in the dashboard header would improve discoverability.

Not essential — the sidebar already provides navigation. This is a UX improvement.

________________________________________

9.5 What Works Well
________________________________________

1. Single-endpoint dashboard pattern — Both WHS pages use one endpoint, one hook, one loading state. Clean and consistent with the other 4 dashboards.

2. Component composition — All section components (PendingIncidentsTable, CasesByStatus, RecentActivity) are presentational with explicit prop interfaces. No internal data fetching. Easy to test.

3. Backend query parallelism — `whs-dashboard.service.ts` runs 7 independent queries in `Promise.all()`. `whs-analytics.service.ts` runs 9 queries (including 3 raw SQL) in `Promise.all()`. Good performance optimization.

4. Raw SQL for analytics — The analytics service correctly uses `$queryRaw` for timezone-aware date grouping and average calculations. This avoids fetching rows to the application layer for aggregation.

5. Zero-fill dates in trend chart — `whs-analytics.service.ts:206-214` fills gaps with zero-value entries so the chart renders a continuous line even when no incidents occur on certain days. Good UX.

6. Cache invalidation — All 4 mutation hooks (approve, reject, create incident, update case) correctly invalidate `['dashboard']` prefix, which covers all dashboard queries broadly. Follows established pattern.

7. Activity feed formatting — Server-side message formatting with `formatEventMessage()` produces human-readable activity descriptions with correct payload key mapping. Note: `buildActionUrl()` deep links work for case events but are broken for incident events (see BUG 3).

8. Empty states — All chart components and dashboard sections handle zero-data gracefully with `EmptyState` component.

9. Type safety — Frontend types (`whs-dashboard.types.ts`, `whs-analytics.types.ts`) import actual enum types from `incident.types.ts` for `IncidentType`, `IncidentSeverity`, and `RejectionReason`. No loose `string` types where enums exist.

10. Chart color centralization — `chartConfig.ts` centralizes all chart colors in one file with semantic color mapping. Pastel palette is visually consistent.

________________________________________

9.6 Recommendations Summary
________________________________________

Critical (Must Fix):
  1. Run Prisma migration + client generation to fix `worker_role_at_miss` field — missed check-in detection is fully broken
  2. Clarify WHS Analytics access control (WHS-only vs WHS+ADMIN) and align backend route + frontend route guard + sidebar navigation
  3. Add `incidentId` to all 3 incident event payloads in `incident.service.ts` — activity feed action URLs are broken for all incident events (CREATED, APPROVED, REJECTED)

Optional (Nice to Improve):
  4. Fix IncidentTrendChart double-rendering (stacked areas + total line overlap)
  5. Replace in-memory severity sort with SQL-level ordering for pending incidents (only matters at scale)
  6. Add "View Analytics" link in WHS Dashboard header for discoverability

________________________________________

