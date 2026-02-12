# Phase 6: Decision Log & Explainability

**Gap addressed**: Major Issue #3 (No Feature Versioning/Explainability)
**Risk**: Low -- additive logging, no breaking changes
**Depends on**: Phase 4 (baselines) + Phase 5 (episodes)

## Objective

Record **why** every risk decision was made -- what features were used, what baseline was compared against, what rules triggered, and what version of the algorithm was running. This enables auditing, debugging, and proving that the system is working correctly.

## Why This Matters

```
Without decision log:
  Supervisor: "Why was Pedro flagged as HIGH risk?"
  System: "readiness_score = 76"
  Supervisor: "But 76 is GREEN??"
  System: (no explanation available)

With decision log:
  Supervisor: "Why was Pedro flagged as HIGH risk?"
  System: "Pedro's readiness 76 is normal, BUT his stress_level=8 vs personal baseline of 3.0
           gives a z-score of 5.4 (threshold: 2.5). Rule: SINGLE_DIMENSION_EXTREME.
           Engine: rules_v1.0, baseline: 28d window, computed 2026-02-11."
```

## Database Changes

### Migration: DecisionLog model

```prisma
model DecisionLog {
  id            String   @id @default(uuid())
  company_id    String
  person_id     String
  decision_type String   // 'DEVIATION_COMPUTED', 'EPISODE_OPENED', 'EPISODE_CLOSED', 'BASELINE_COMPUTED'
  decision_time DateTime // When the decision was made
  entity_type   String   // 'check_in_deviation', 'risk_episode', 'person_baseline'
  entity_id     String?  // ID of the entity this decision relates to

  // Decision data
  input_data   Json  // Features/scores used as input
  output_data  Json  // Result: severity, triggered rules, etc.
  version_info Json  // Algorithm version, baseline window, etc.
  explanations Json  // Array of human-readable explanation strings

  created_at DateTime @default(now())

  // Relations
  company Company @relation(fields: [company_id], references: [id], onDelete: Cascade)
  person  Person  @relation(fields: [person_id], references: [id], onDelete: Cascade)

  @@index([company_id, person_id, decision_time])
  @@index([company_id, decision_type, decision_time])
  @@index([company_id, entity_type, entity_id])
  @@map("decision_logs")
}
```

## Backend Changes

### 1. NEW: `src/shared/decision-log.ts`

Fire-and-forget logging utility:

```typescript
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export const BASELINE_VERSION = 'baseline_v1.0';
export const RULE_VERSION = 'rules_v1.0';

interface LogDecisionInput {
  companyId: string;
  personId: string;
  decisionType: string;
  entityType: string;
  entityId?: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  explanations: string[];
}

/**
 * Fire-and-forget: Log a risk decision with full context.
 * NEVER await this. NEVER throw from this.
 */
export function logDecision(input: LogDecisionInput): void {
  prisma.decisionLog.create({
    data: {
      company_id: input.companyId,
      person_id: input.personId,
      decision_type: input.decisionType,
      decision_time: new Date(),
      entity_type: input.entityType,
      entity_id: input.entityId,
      input_data: input.inputData,
      output_data: input.outputData,
      version_info: {
        baseline_version: BASELINE_VERSION,
        rule_version: RULE_VERSION,
        baseline_window: '28d',
      },
      explanations: input.explanations,
    },
  }).catch(err => {
    logger.error({ err, decisionType: input.decisionType }, 'Failed to log decision');
  });
}
```

### 2. MODIFY: `src/modules/baseline/baseline.service.ts`

Log baseline computations:

```typescript
import { logDecision, BASELINE_VERSION } from '../../shared/decision-log';

async calculateBaseline(personId, asOfDate, windowDays) {
  // ... existing computation ...
  const baseline = await prisma.personBaseline.upsert({ ... });

  // Log baseline computation
  logDecision({
    companyId: this.companyId,
    personId,
    decisionType: 'BASELINE_COMPUTED',
    entityType: 'person_baseline',
    entityId: baseline.id,
    inputData: {
      checkInCount: checkIns.length,
      windowDays,
      dateRange: { from: startDate.toISOString(), to: asOfDate.toISOString() },
    },
    outputData: {
      readinessMedian: baseline.readiness_score_median,
      readinessMAD: baseline.readiness_score_mad,
      stressMedian: baseline.stress_level_median,
      stressMAD: baseline.stress_level_mad,
    },
    explanations: [
      `Computed ${windowDays}-day baseline from ${checkIns.length} check-ins`,
      `Readiness median: ${baseline.readiness_score_median?.toFixed(1)}, MAD: ${baseline.readiness_score_mad?.toFixed(2)}`,
      `Stress median: ${baseline.stress_level_median?.toFixed(1)}, MAD: ${baseline.stress_level_mad?.toFixed(2)}`,
    ],
  });
}
```

Log deviation detections:

```typescript
async detectDeviation(checkInId) {
  // ... existing computation ...
  const deviation = await prisma.checkInDeviation.upsert({ ... });

  logDecision({
    companyId: this.companyId,
    personId: checkIn.person_id,
    decisionType: 'DEVIATION_COMPUTED',
    entityType: 'check_in_deviation',
    entityId: deviation.id,
    inputData: {
      checkInId,
      currentValues: {
        sleepHours: checkIn.hours_slept,
        stressLevel: checkIn.stress_level,
        physicalCondition: checkIn.physical_condition,
        readinessScore: checkIn.readiness_score,
      },
      baselineId: baseline.id,
      baselineValues: {
        sleepMedian: baseline.sleep_hours_median,
        stressMedian: baseline.stress_level_median,
        readinessMedian: baseline.readiness_score_median,
      },
    },
    outputData: {
      severity: deviation.severity,
      triggeredRules: deviation.triggered_rules,
      zScores: { sleepZ, stressZ, physicalZ, readinessZ },
    },
    explanations: buildExplanations(checkIn, baseline, { sleepZ, stressZ, physicalZ, readinessZ }),
  });
}

function buildExplanations(checkIn, baseline, zScores): string[] {
  const explanations: string[] = [];

  if (Math.abs(zScores.stressZ ?? 0) > 1.8) {
    explanations.push(
      `Stress ${checkIn.stress_level} vs baseline ${baseline.stress_level_median?.toFixed(1)} ` +
      `(z-score: ${zScores.stressZ?.toFixed(2)}, threshold: 2.5)`
    );
  }
  if (Math.abs(zScores.readinessZ ?? 0) > 1.8) {
    explanations.push(
      `Readiness ${checkIn.readiness_score} vs baseline ${baseline.readiness_score_median?.toFixed(1)} ` +
      `(z-score: ${zScores.readinessZ?.toFixed(2)}, threshold: 2.5)`
    );
  }
  // ... similar for sleep, physical

  if (explanations.length === 0) {
    explanations.push('All metrics within normal range');
  }

  return explanations;
}
```

### 3. MODIFY: `src/modules/episode/episode.service.ts`

Log episode lifecycle events:

```typescript
import { logDecision } from '../../shared/decision-log';

// When opening a new episode:
logDecision({
  companyId: this.companyId,
  personId,
  decisionType: 'EPISODE_OPENED',
  entityType: 'risk_episode',
  entityId: episode.id,
  inputData: { episodeType, signalCount, consecutiveDays },
  outputData: { severity, status: 'ACTIVE' },
  explanations: [
    `Opened ${episodeType} episode: ${consecutiveDays} consecutive days`,
    `Severity: ${severity}`,
  ],
});

// When closing/resolving:
logDecision({
  companyId: this.companyId,
  personId,
  decisionType: 'EPISODE_CLOSED',
  entityType: 'risk_episode',
  entityId: episode.id,
  inputData: { durationDays: episode.consecutive_days },
  outputData: { resolution: 'auto_resolved', reason: 'No signals for 14 days' },
  explanations: [`Episode resolved after ${episode.consecutive_days} days`],
});
```

### 4. NEW: Read-only endpoint

`GET /api/v1/decision-log/:personId` -- WHS and Admin only

Returns paginated decision log with all context for a specific worker.

## Frontend Changes

### 1. MODIFY: `src/features/team/pages/TeamWorkerDetailPage.tsx`

Add expandable "Decision Log" section (visible to WHS/Admin):

```tsx
<Card>
  <CardHeader>
    <CardTitle>Decision Log</CardTitle>
    <CardDescription>Risk assessment decisions and explanations</CardDescription>
  </CardHeader>
  <CardContent>
    {decisions.map(decision => (
      <div key={decision.id} className="border-l-2 border-blue-200 pl-4 mb-4">
        <p className="text-sm font-medium">{decision.decisionType}</p>
        <p className="text-xs text-muted-foreground">{formatDate(decision.decisionTime)}</p>
        <ul className="text-sm mt-1 space-y-1">
          {decision.explanations.map((exp, i) => (
            <li key={i}>{exp}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-1">
          Engine: {decision.versionInfo.ruleVersion} | Baseline: {decision.versionInfo.baselineWindow}
        </p>
      </div>
    ))}
  </CardContent>
</Card>
```

### 2. NEW: Query hook

`useDecisionLog(personId, page, limit)` -- Paginated decision log for a worker.

## Key Files

| File | Action |
|------|--------|
| `aegira-backend/prisma/schema.prisma` | New DecisionLog model |
| `aegira-backend/src/shared/decision-log.ts` | NEW -- fire-and-forget logging |
| `aegira-backend/src/modules/baseline/baseline.service.ts` | Modify (log decisions) |
| `aegira-backend/src/modules/episode/episode.service.ts` | Modify (log decisions) |
| `aegira-frontend/src/features/team/pages/TeamWorkerDetailPage.tsx` | Modify (decision log section) |

## Verification

1. Submit check-in that triggers HIGH deviation -> decision log entry created with:
   - `input_data`: current values + baseline values
   - `output_data`: severity + triggered rules + z-scores
   - `explanations`: "Stress 8 vs baseline 3.0 (z-score: 5.4, threshold: 2.5)"
   - `version_info`: "rules_v1.0, baseline: 28d"
2. Baseline calculation job runs -> decision log entry with computation details
3. Episode opens -> decision log entry with trigger reason
4. Episode auto-closes -> decision log entry with resolution
5. WHS officer can view decision log for any worker
6. Decision log entries never block main operations (fire-and-forget)
