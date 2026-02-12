# Phase 5: Risk Episodes & Signal Clustering

**Gap addressed**: Major Issue #1 (No Risk Episodes/Signal Clustering)
**Risk**: Medium -- new analytics layer, no breaking changes
**Depends on**: Phase 4 (deviations as input signals)

## Objective

Group consecutive risk signals (low readiness, high deviations, missed patterns) into **risk episodes** -- trackable incidents with a lifecycle (ACTIVE -> MANAGED -> RESOLVED). This enables pattern detection beyond single-day snapshots.

## Current Problem

```
Monday:    readiness=55 -> YELLOW (evaluated independently)
Tuesday:   readiness=52 -> YELLOW (evaluated independently)
Wednesday: readiness=48 -> RED   (evaluated independently)

System sees 3 separate check-ins. Doesn't detect this is a sustained pattern.
No alert until Wednesday (when it's already day 3).
```

## After Phase 5

```
Monday:    readiness=55, readiness_z=-2.1 -> deviation detected
Tuesday:   readiness=52, readiness_z=-2.5 -> deviation detected
Wednesday: readiness=48, readiness_z=-3.0 -> deviation detected

Episode logic: "3 consecutive days with LOW_READINESS"
-> RiskEpisode created: type=LOW_READINESS, severity=MEDIUM, status=ACTIVE
-> Supervisor notified: "Worker X has sustained low readiness (3 days)"

After 14 days of normal scores -> Episode auto-closes (RESOLVED)
```

## Database Changes

### Migration: RiskEpisode model

```prisma
enum EpisodeType {
  LOW_READINESS      // 3+ consecutive days readiness_score < 60
  HIGH_DEVIATION     // 2+ HIGH severity deviations within 7 days
  MISSED_PATTERN     // 3+ unresolved misses in 7 days
}

enum EpisodeSeverity {
  LOW
  MEDIUM
  HIGH
}

enum EpisodeStatus {
  ACTIVE    // Episode detected, no action taken yet
  MANAGED   // Supervisor acknowledged / action in progress
  RESOLVED  // No signals for 14 days, auto-closed
  CLOSED    // Manually closed by supervisor with notes
}

model RiskEpisode {
  id           String          @id @default(uuid())
  company_id   String
  person_id    String
  episode_type EpisodeType
  severity     EpisodeSeverity
  status       EpisodeStatus   @default(ACTIVE)

  start_date       DateTime @db.Date   // First signal date
  end_date         DateTime? @db.Date  // Last signal date (null if ongoing)
  signal_count     Int                 // Number of signals in this episode
  consecutive_days Int                 // Consecutive days with signals

  // Episode metrics
  avg_readiness    Float?  // Average readiness during episode
  min_readiness    Float?  // Lowest readiness during episode

  // Resolution
  resolved_at      DateTime?
  resolution_notes String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  // Relations
  company Company @relation(fields: [company_id], references: [id], onDelete: Cascade)
  person  Person  @relation(fields: [person_id], references: [id], onDelete: Cascade)

  @@index([company_id, person_id, status, start_date])
  @@index([company_id, status])
  @@index([company_id, severity, status])
  @@map("risk_episodes")
}
```

## Backend Changes

### 1. NEW: `src/modules/episode/episode.service.ts`

```typescript
export class EpisodeService {
  constructor(
    private readonly companyId: string,
    private readonly timezone: string
  ) {}

  /**
   * Run episode detection for a person after check-in.
   * Called fire-and-forget from check-in.service.ts.
   */
  async detectEpisodes(personId: string, checkInDate: Date): Promise<void> {
    await this.detectLowReadiness(personId, checkInDate);
    await this.detectHighDeviation(personId, checkInDate);
    await this.detectMissedPattern(personId, checkInDate);
    await this.autoCloseStaleEpisodes(personId, checkInDate);
  }

  /**
   * LOW_READINESS: 3+ consecutive days with readiness_score < 60
   */
  private async detectLowReadiness(personId: string, today: Date) {
    const last7Days = await prisma.checkIn.findMany({
      where: {
        company_id: this.companyId,
        person_id: personId,
        check_in_date: { gte: subtractDays(today, 7), lte: today },
      },
      orderBy: { check_in_date: 'asc' },
    });

    // Find longest consecutive run of readiness < 60
    let consecutiveLow = 0;
    let maxConsecutive = 0;
    const lowDays: CheckIn[] = [];

    for (const ci of last7Days) {
      if (ci.readiness_score < 60) {
        consecutiveLow++;
        lowDays.push(ci);
        maxConsecutive = Math.max(maxConsecutive, consecutiveLow);
      } else {
        consecutiveLow = 0;
      }
    }

    if (maxConsecutive >= 3) {
      await this.openOrUpdateEpisode(personId, 'LOW_READINESS', lowDays, today);
    } else {
      // No trigger -> close any active LOW_READINESS episode
      await this.autoCloseEpisode(personId, 'LOW_READINESS');
    }
  }

  /**
   * HIGH_DEVIATION: 2+ HIGH severity deviations within 7 days
   */
  private async detectHighDeviation(personId: string, today: Date) {
    const recentHighDeviations = await prisma.checkInDeviation.count({
      where: {
        company_id: this.companyId,
        person_id: personId,
        severity: 'HIGH',
        created_at: { gte: subtractDays(today, 7) },
      },
    });

    if (recentHighDeviations >= 2) {
      await this.openOrUpdateEpisode(personId, 'HIGH_DEVIATION', [], today);
    }
  }

  /**
   * MISSED_PATTERN: 3+ unresolved misses in 7 days
   */
  private async detectMissedPattern(personId: string, today: Date) {
    const unresolvedMisses = await prisma.missedCheckIn.count({
      where: {
        company_id: this.companyId,
        person_id: personId,
        missed_date: { gte: subtractDays(today, 7) },
        resolved_at: null, // Only unresolved
      },
    });

    if (unresolvedMisses >= 3) {
      await this.openOrUpdateEpisode(personId, 'MISSED_PATTERN', [], today);
    }
  }

  /**
   * Auto-close episodes with no signals for 14 days
   */
  private async autoCloseStaleEpisodes(personId: string, today: Date) {
    const staleDate = subtractDays(today, 14);
    await prisma.riskEpisode.updateMany({
      where: {
        company_id: this.companyId,
        person_id: personId,
        status: 'ACTIVE',
        end_date: { lte: staleDate },
      },
      data: {
        status: 'RESOLVED',
        resolved_at: new Date(),
        resolution_notes: 'Auto-resolved: no signals for 14 days',
      },
    });
  }

  private calculateSeverity(avgReadiness: number | null, days: number): EpisodeSeverity {
    if ((avgReadiness !== null && avgReadiness < 40) || days >= 7) return 'HIGH';
    if ((avgReadiness !== null && avgReadiness < 50) || days >= 5) return 'MEDIUM';
    return 'LOW';
  }
}
```

### 2. NEW: `src/modules/episode/episode.repository.ts`

Extends BaseRepository with episode-specific queries:
- `findActiveByPerson(personId)` -- Active episodes for a worker
- `findActiveByTeam(teamId)` -- Active episodes for all team members
- `findAll(params)` -- Paginated list with filters (status, severity, type)

### 3. NEW: `src/modules/episode/episode.controller.ts`

Endpoints:
- `GET /api/v1/episodes` -- List episodes (paginated, filterable)
- `GET /api/v1/episodes/active` -- Active episodes for current user's team/company
- `GET /api/v1/episodes/:id` -- Episode detail
- `PATCH /api/v1/episodes/:id` -- Update status (MANAGED/CLOSED) + resolution notes

### 4. MODIFY: `src/modules/check-in/check-in.service.ts`

Fire-and-forget episode detection after check-in:

```typescript
// After check-in creation + deviation detection
const episodeService = new EpisodeService(companyId, this.timezone);
episodeService.detectEpisodes(personId, today).catch(err =>
  logger.error({ err, personId }, 'Episode detection failed')
);
```

### 5. MODIFY: `src/modules/dashboard/dashboard.service.ts`

Include active episode counts in team lead/supervisor dashboard stats.

## Frontend Changes

### 1. NEW: `src/features/dashboard/components/EpisodeAlerts.tsx`

Alert banners for active episodes (shown in dashboards):

```tsx
<Alert variant="destructive">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Risk Episode: Low Readiness (HIGH)</AlertTitle>
  <AlertDescription>
    Worker has had low readiness for 5 consecutive days (avg: 45)
  </AlertDescription>
</Alert>
```

### 2. NEW: `src/features/episode/pages/EpisodesPage.tsx`

Invoke `/data-table-page` -- paginated table of episodes with filters:
- Status filter (ACTIVE/MANAGED/RESOLVED/CLOSED)
- Severity filter (LOW/MEDIUM/HIGH)
- Episode type filter
- Search by worker name

### 3. NEW: Query hooks

Invoke `/query-hooks`:
- `useActiveEpisodes(teamId?)` -- Active episodes for team/company
- `useEpisodes(page, limit, filters)` -- Paginated episode list
- `useEpisode(id)` -- Episode detail

### 4. MODIFY: Dashboards

- `TeamLeaderDashboard.tsx` -- Show EpisodeAlerts for team members
- `SupervisorDashboard.tsx` -- Show episode count per team
- `WhsDashboard.tsx` -- Show all active episodes company-wide

### 5. MODIFY: Sidebar

Add "Risk Episodes" nav item for TEAM_LEAD, SUPERVISOR, WHS, ADMIN.

## Key Files

| File | Action |
|------|--------|
| `aegira-backend/prisma/schema.prisma` | New RiskEpisode model + enums |
| `aegira-backend/src/modules/episode/episode.service.ts` | NEW |
| `aegira-backend/src/modules/episode/episode.repository.ts` | NEW |
| `aegira-backend/src/modules/episode/episode.controller.ts` | NEW |
| `aegira-backend/src/modules/episode/episode.routes.ts` | NEW |
| `aegira-backend/src/modules/episode/episode.validator.ts` | NEW |
| `aegira-backend/src/modules/check-in/check-in.service.ts` | Modify |
| `aegira-backend/src/modules/dashboard/dashboard.service.ts` | Modify |
| `aegira-backend/src/app.ts` | Modify (register episode routes) |
| `aegira-frontend/src/features/dashboard/components/EpisodeAlerts.tsx` | NEW |
| `aegira-frontend/src/features/episode/pages/EpisodesPage.tsx` | NEW |
| `aegira-frontend/src/components/layout/Sidebar.tsx` | Modify |

## Skills to Invoke

- `/backend-crud-module episode`
- `/data-table-page episodes list`
- `/query-hooks episodes`

## Verification

1. Submit 3 consecutive check-ins with readiness < 60 -> RiskEpisode created (LOW_READINESS)
2. Submit 2 check-ins with HIGH deviation within 7 days -> RiskEpisode created (HIGH_DEVIATION)
3. Have 3 unresolved misses in 7 days -> RiskEpisode created (MISSED_PATTERN)
4. Submit normal check-ins for 14 days -> active episode auto-resolves
5. Supervisor marks episode as MANAGED -> status updates, notes saved
6. Episode alerts show on team lead dashboard
7. Episodes page shows paginated list with filters
