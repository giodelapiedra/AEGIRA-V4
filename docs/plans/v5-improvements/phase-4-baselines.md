# Phase 4: Personal Baselines & Deviation Detection

**Gaps addressed**: #6 (No Baselines/Longitudinal Features), #7 (Absolute Thresholds vs Deviation)
**Risk**: Medium -- new analytics computation, no breaking changes
**Depends on**: Phase 1 (event-time tracking for accurate baseline windows)

## Objective

Replace absolute readiness thresholds ("< 50 = RED for everyone") with **within-person deviation detection**. Each worker gets a personal baseline computed from their 28-day rolling history. Deviations are flagged when current scores differ significantly from their personal normal.

## Why This Matters

```
Worker A (always reports high):
  Baseline: readiness=95, stress=2
  Today:    readiness=85, stress=4
  Current system: GREEN (85 > 70) -- no alert
  With baselines: readiness_z = -2.8 -- SIGNIFICANT deviation!

Worker B (stoic, always reports low):
  Baseline: readiness=65, stress=7
  Today:    readiness=65, stress=7
  Current system: YELLOW (65 < 70) -- flagged
  With baselines: readiness_z = 0.0 -- completely normal for this person
```

## Database Changes

### Migration: PersonBaseline + CheckInDeviation

```prisma
model PersonBaseline {
  id            String   @id @default(uuid())
  company_id    String
  person_id     String
  baseline_date DateTime @db.Date   // Date this baseline was computed for
  window_days   Int      @default(28) // Rolling window size

  // Baseline metrics (robust median + MAD)
  // These field names match the actual CheckIn model columns
  sleep_hours_median          Float?  // from CheckIn.hours_slept
  sleep_hours_mad             Float?
  sleep_quality_median        Float?  // from CheckIn.sleep_quality (1-10)
  sleep_quality_mad           Float?
  stress_level_median         Float?  // from CheckIn.stress_level (1-10)
  stress_level_mad            Float?
  physical_condition_median   Float?  // from CheckIn.physical_condition (1-10)
  physical_condition_mad      Float?
  readiness_score_median      Float?  // from CheckIn.readiness_score (0-100)
  readiness_score_mad         Float?

  // Sample metadata
  check_in_count Int              // Number of check-ins in window
  version        String @default("v1.0") // Algorithm version

  created_at DateTime @default(now())

  // Relations
  company    Company            @relation(fields: [company_id], references: [id], onDelete: Cascade)
  person     Person             @relation(fields: [person_id], references: [id], onDelete: Cascade)
  deviations CheckInDeviation[]

  @@unique([person_id, baseline_date, window_days])
  @@index([company_id, baseline_date])
  @@index([company_id, person_id, baseline_date])
  @@map("person_baselines")
}

model CheckInDeviation {
  id          String @id @default(uuid())
  company_id  String
  check_in_id String @unique  // One deviation per check-in
  person_id   String
  baseline_id String          // Which baseline was used

  // Z-scores (robust: (current - median) / (1.4826 * MAD))
  sleep_z     Float?   // z-score for hours_slept
  stress_z    Float?   // z-score for stress_level
  physical_z  Float?   // z-score for physical_condition
  readiness_z Float?   // z-score for readiness_score

  // Risk classification
  severity        String  // 'LOW', 'MEDIUM', 'HIGH'
  triggered_rules Json    // Array of rule IDs that triggered

  created_at DateTime @default(now())

  // Relations
  check_in CheckIn        @relation(fields: [check_in_id], references: [id], onDelete: Cascade)
  person   Person         @relation(fields: [person_id], references: [id], onDelete: Cascade)
  baseline PersonBaseline @relation(fields: [baseline_id], references: [id], onDelete: Cascade)

  @@index([company_id, person_id, created_at])
  @@index([company_id, severity])
  @@map("check_in_deviations")
}
```

## Backend Changes

### 1. NEW: `src/modules/baseline/baseline.service.ts`

Core computation engine:

```typescript
export class BaselineService {
  constructor(
    private readonly companyId: string,
    private readonly timezone: string
  ) {}

  /**
   * Calculate 28-day rolling baseline for a worker.
   * Uses robust statistics (median + MAD) instead of mean + stddev.
   * Minimum 5 check-ins required for meaningful baseline.
   */
  async calculateBaseline(personId: string, asOfDate: Date, windowDays = 28) {
    const startDate = subtractDays(asOfDate, windowDays);

    const checkIns = await prisma.checkIn.findMany({
      where: {
        company_id: this.companyId,
        person_id: personId,
        check_in_date: { gte: startDate, lte: asOfDate },
      },
      select: {
        hours_slept: true,
        sleep_quality: true,
        stress_level: true,
        physical_condition: true,
        readiness_score: true,
      },
    });

    if (checkIns.length < 5) return null; // Not enough data

    return prisma.personBaseline.upsert({
      where: {
        person_id_baseline_date_window_days: {
          person_id: personId,
          baseline_date: asOfDate,
          window_days: windowDays,
        },
      },
      create: {
        company_id: this.companyId,
        person_id: personId,
        baseline_date: asOfDate,
        window_days: windowDays,
        sleep_hours_median: median(checkIns.map(c => c.hours_slept)),
        sleep_hours_mad: mad(checkIns.map(c => c.hours_slept)),
        sleep_quality_median: median(checkIns.map(c => c.sleep_quality)),
        sleep_quality_mad: mad(checkIns.map(c => c.sleep_quality)),
        stress_level_median: median(checkIns.map(c => c.stress_level)),
        stress_level_mad: mad(checkIns.map(c => c.stress_level)),
        physical_condition_median: median(checkIns.map(c => c.physical_condition)),
        physical_condition_mad: mad(checkIns.map(c => c.physical_condition)),
        readiness_score_median: median(checkIns.map(c => c.readiness_score)),
        readiness_score_mad: mad(checkIns.map(c => c.readiness_score)),
        check_in_count: checkIns.length,
        version: BASELINE_VERSION,
      },
      update: { /* same fields */ },
    });
  }

  /**
   * Detect deviation from baseline for a check-in.
   * Uses robust z-score: (current - median) / (1.4826 * MAD + epsilon)
   */
  async detectDeviation(checkInId: string) {
    const checkIn = await prisma.checkIn.findUnique({
      where: { id: checkInId },
    });
    if (!checkIn) return null;

    const baseline = await prisma.personBaseline.findFirst({
      where: {
        company_id: this.companyId,
        person_id: checkIn.person_id,
        baseline_date: { lte: checkIn.check_in_date },
        window_days: 28,
      },
      orderBy: { baseline_date: 'desc' },
    });
    if (!baseline) return null;

    const sleepZ = robustZScore(checkIn.hours_slept, baseline.sleep_hours_median, baseline.sleep_hours_mad);
    const stressZ = robustZScore(checkIn.stress_level, baseline.stress_level_median, baseline.stress_level_mad);
    const physicalZ = robustZScore(checkIn.physical_condition, baseline.physical_condition_median, baseline.physical_condition_mad);
    const readinessZ = robustZScore(checkIn.readiness_score, baseline.readiness_score_median, baseline.readiness_score_mad);

    const { severity, triggeredRules } = classifySeverity({ sleepZ, stressZ, physicalZ, readinessZ });

    return prisma.checkInDeviation.upsert({
      where: { check_in_id: checkInId },
      create: {
        company_id: this.companyId,
        check_in_id: checkInId,
        person_id: checkIn.person_id,
        baseline_id: baseline.id,
        sleep_z: sleepZ, stress_z: stressZ,
        physical_z: physicalZ, readiness_z: readinessZ,
        severity, triggered_rules: triggeredRules,
      },
      update: { /* same fields */ },
    });
  }
}
```

### Severity Classification Rules

```typescript
function classifySeverity(zScores: ZScores): { severity: string; triggeredRules: string[] } {
  const triggeredRules: string[] = [];
  const absScores = [
    { name: 'sleep', z: Math.abs(zScores.sleepZ ?? 0) },
    { name: 'stress', z: Math.abs(zScores.stressZ ?? 0) },
    { name: 'physical', z: Math.abs(zScores.physicalZ ?? 0) },
    { name: 'readiness', z: Math.abs(zScores.readinessZ ?? 0) },
  ];

  // HIGH: any z > 2.5 OR 2+ dimensions z > 2.0
  if (absScores.some(s => s.z > 2.5)) {
    triggeredRules.push('SINGLE_DIMENSION_EXTREME');
    return { severity: 'HIGH', triggeredRules };
  }
  const above2 = absScores.filter(s => s.z > 2.0);
  if (above2.length >= 2) {
    triggeredRules.push('MULTI_DIMENSION_ELEVATED');
    return { severity: 'HIGH', triggeredRules };
  }

  // MEDIUM: any z > 1.8
  if (absScores.some(s => s.z > 1.8)) {
    triggeredRules.push('SINGLE_DIMENSION_ELEVATED');
    return { severity: 'MEDIUM', triggeredRules };
  }

  return { severity: 'LOW', triggeredRules: [] };
}
```

### Math Utilities

```typescript
// Robust z-score using MAD (Median Absolute Deviation)
// Scale factor 1.4826 makes MAD consistent with standard deviation for normal distributions
function robustZScore(current: number, median: number | null, mad: number | null): number | null {
  if (median === null || mad === null) return null;
  const EPSILON = 0.001; // Avoid division by zero
  return (current - median) / (1.4826 * mad + EPSILON);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mad(values: number[]): number {
  const med = median(values);
  const deviations = values.map(v => Math.abs(v - med));
  return median(deviations);
}
```

### 2. NEW: `src/jobs/calculate-baselines.ts`

Daily job registered in scheduler (2 AM company time):

```typescript
export async function calculateBaselines(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { is_active: true },
    select: { id: true, timezone: true },
  });

  for (const company of companies) {
    const service = new BaselineService(company.id, company.timezone);
    const workers = await prisma.person.findMany({
      where: { company_id: company.id, role: 'WORKER', is_active: true },
      select: { id: true },
    });

    const today = parseDateInTimezone(getTodayInTimezone(company.timezone), company.timezone);
    for (const worker of workers) {
      await service.calculateBaseline(worker.id, today, 28).catch(err =>
        logger.error({ err, personId: worker.id }, 'Baseline calculation failed')
      );
    }
  }
}
```

### 3. MODIFY: `src/modules/check-in/check-in.service.ts`

Fire-and-forget deviation detection after check-in:

```typescript
// After successful check-in creation (outside transaction)
const baselineService = new BaselineService(companyId, this.timezone);
baselineService.detectDeviation(checkIn.id).catch(err =>
  logger.error({ err, checkInId: checkIn.id }, 'Deviation detection failed')
);
```

### 4. NEW: Baseline read endpoints

- `GET /api/v1/baselines/:personId` -- Latest baseline for person (TEAM_LEAD/SUPERVISOR/WHS/ADMIN)
- `GET /api/v1/baselines/:personId/deviations` -- Recent deviations with z-scores (paginated)

## Frontend Changes

### 1. NEW: `src/features/dashboard/components/BaselineTrendChart.tsx`

Recharts AreaChart showing:
- Worker's readiness scores over time (blue area)
- Personal baseline median (green reference line)
- +/- 2 MAD bounds (red dashed lines)
- Deviation points highlighted (orange/red dots)

### 2. NEW: Query hooks

- `usePersonBaseline(personId)` -- Latest 28-day baseline
- `useDeviations(personId, page, limit)` -- Recent deviations (paginated)

### 3. MODIFY: `WorkerDashboard.tsx`

Add BaselineTrendChart below existing StatCards (only shown if baseline exists).

### 4. MODIFY: `TeamWorkerDetailPage.tsx`

Show baseline chart when supervisors/WHS/admin view a worker's profile.

## Key Files

| File | Action |
|------|--------|
| `aegira-backend/prisma/schema.prisma` | New PersonBaseline, CheckInDeviation models |
| `aegira-backend/src/modules/baseline/baseline.service.ts` | NEW -- computation engine |
| `aegira-backend/src/modules/baseline/baseline.controller.ts` | NEW -- read endpoints |
| `aegira-backend/src/modules/baseline/baseline.routes.ts` | NEW -- route registration |
| `aegira-backend/src/jobs/calculate-baselines.ts` | NEW -- daily job |
| `aegira-backend/src/jobs/scheduler.ts` | Modify -- register daily baseline job |
| `aegira-backend/src/modules/check-in/check-in.service.ts` | Modify -- fire-and-forget deviation |
| `aegira-frontend/src/features/dashboard/components/BaselineTrendChart.tsx` | NEW |
| `aegira-frontend/src/features/dashboard/pages/WorkerDashboard.tsx` | Modify |
| `aegira-frontend/src/features/team/pages/TeamWorkerDetailPage.tsx` | Modify |

## Verification

1. Submit 10+ check-ins for a worker over multiple days
2. Run `calculateBaselines()` job -> verify `PersonBaseline` record created with median/MAD values
3. Worker with < 5 check-ins -> no baseline created (skipped)
4. Submit outlier check-in (e.g., stress=9 when baseline median is 3) -> verify `CheckInDeviation` created with HIGH severity
5. Submit normal check-in -> verify deviation created with LOW severity
6. Worker dashboard shows baseline trend chart with reference lines
7. Supervisor viewing worker profile sees baseline chart
