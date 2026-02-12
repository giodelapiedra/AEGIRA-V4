# AEGIRA V5 vs Technical Build Playbook - Complete Analysis

## Executive Summary

### 🔴 Critical Finding

**AEGIRA V5 is NOT a time-aware longitudinal risk system** as required by the Technical Build Playbook.

- **Current V5** = Check-in survey storage with basic scoring
- **Required** = Event-sourced risk infrastructure with baselines, deviations, episodes, and full audit trail

### Gap Statistics

- **7 Critical Gaps** 🔴
- **5 Major Issues** 🟠
- **4 Architectural Problems** 🟡
- **3 Data Model Issues** 🔵

---

## Part 1: Critical Gaps Analysis

### 1. Event-Time vs Database-Time 🔴 CRITICAL

#### Current V5:
```
Using created_at from database as the source of truth
```

#### Required by Playbook:
```
Must have:
- event_time (when it happened)
- ingested_at (when received)
- timezone
```

#### Impact:
**SEVERE** - Cannot detect late submissions, cannot handle multi-timezone, all time-based analytics are wrong

#### Why This Matters:
> Playbook: "All analytics use event_time, not ingested_at"

#### How to Fix:
```sql
-- Add to check_ins table
ALTER TABLE check_ins ADD COLUMN event_time TIMESTAMPTZ;
ALTER TABLE check_ins ADD COLUMN ingested_at TIMESTAMPTZ;
ALTER TABLE check_ins ADD COLUMN timezone VARCHAR(50);

-- Capture actual submission time from client
-- event_time = when worker clicked submit (in their timezone)
-- ingested_at = when server received request
```

---

### 2. No Event Sourcing / Append-Only Pattern 🔴 CRITICAL

#### Current V5:
```
Traditional CRUD - UPDATE/DELETE operations allowed on check_ins
Example:
- Worker submits check-in → INSERT
- Worker amends check-in → UPDATE (overwrites original)
- System deletes old data → DELETE
```

#### Required by Playbook:
```
Append-only event log. Never UPDATE or DELETE events.
Use projections for current state.

Example:
- Original submission → event_id_1 (stays forever)
- Amendment → event_id_2 (new event, doesn't delete event_id_1)
- Current state = computed from all events
```

#### Impact:
**SEVERE** - No true audit trail, history can be lost, cannot reproduce decisions, not enterprise-grade

#### Why This Matters:
> Playbook: "Event log is immutable - never overwrite reality"

#### How to Fix:
```sql
-- Create append-only events table
CREATE TABLE events (
  event_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'checkin.response_submitted', 'checkin.window_missed'
  event_time TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(50),
  source VARCHAR(50), -- 'worker_app', 'system', 'integration'
  source_event_id VARCHAR(100), -- for idempotency
  schema_version INTEGER DEFAULT 1,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_events_tenant_worker_time ON events(tenant_id, worker_id, event_time);
CREATE INDEX idx_events_type_time ON events(tenant_id, event_type, event_time);
CREATE UNIQUE INDEX idx_events_dedupe ON events(tenant_id, source, source_event_id) 
  WHERE source_event_id IS NOT NULL;
```

---

### 3. No Shift/Prompt Context 🔴 CRITICAL

#### Current V5:
```
Check-ins exist independently, no shift or prompt reference

check_ins table:
- id
- worker_id
- check_in_date (just a date, no window timing)
- created_at
- fatigue, stress, etc.

Missing:
- What shift was this for?
- When was the check-in window?
- Was this submitted on time or late?
```

#### Required by Playbook:
```
Every check-in must link to:
- shift_id (which shift)
- prompt_id (which specific check-in request)
- window_opens_at (when window started)
- window_closes_at (when window ended)
- prompt_kind (pre_shift, mid_shift, post_shift)
```

#### Impact:
**SEVERE** - Cannot detect if check-in was late, cannot track compliance properly, missed detection is guesswork

#### Why This Matters:
> Playbook: "Without shift context you cannot detect missed vs late"

#### How to Fix:
```sql
-- Create shifts table
CREATE TABLE shifts (
  shift_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  site_id UUID,
  team_id UUID,
  timezone VARCHAR(50) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  source VARCHAR(50) DEFAULT 'manual', -- 'manual' or 'integration'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create prompts table
CREATE TABLE prompts (
  prompt_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  shift_id UUID REFERENCES shifts(shift_id),
  form_id UUID NOT NULL,
  prompt_kind VARCHAR(20) NOT NULL, -- 'pre_shift', 'mid_shift', 'post_shift'
  window_opens_at TIMESTAMPTZ NOT NULL,
  window_closes_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'completed_on_time', 'completed_late', 'missed', 'excused'
  response_id UUID, -- links to event
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Update events to link to prompts
-- In payload field:
{
  "prompt_id": "uuid",
  "shift_id": "uuid",
  "submitted_at": "2026-02-12T07:30:00+08:00",
  "fatigue": 7,
  "stress": 5
}
```

---

### 4. Missed Check-ins: Implied vs Explicit 🔴 CRITICAL

#### Current V5:
```
Missed check-ins inferred by absence

Background job logic:
1. Query: SELECT * FROM check_ins WHERE worker_id='juan' AND date=today
2. If no rows found → "He missed it"
3. Create record in missed_check_ins table

Problem: "Missed" is implied by absence, not explicitly recorded
```

#### Required by Playbook:
```
Missed check-ins MUST be explicit events

At window_closes_at:
1. Check if response exists for this prompt
2. If no response → Emit event:
   {
     event_type: "checkin.window_missed",
     event_id: "evt_miss_001",
     prompt_id: "pr_001",
     worker_id: "juan",
     event_time: "2026-02-12T06:05:00+08:00", // exactly when window closed
     payload: {
       window_closed_at: "2026-02-12T06:05:00+08:00",
       availability_snapshot: "available",
       reason: "no_submission"
     }
   }

This creates an actual EVENT ROW - not just inferred
```

#### Impact:
**SEVERE** - Cannot distinguish between "not checked in yet" vs "missed the window", compliance metrics wrong

#### Why This Matters:
> Playbook: "Missed events MUST be explicit rows, never implied"

#### How to Fix:
```javascript
// Background job that runs at end of each window
async function detectMissedCheckIns() {
  // Get all prompts that just closed
  const closedPrompts = await db.prompts.findMany({
    where: {
      window_closes_at: { lte: now },
      status: 'scheduled' // not completed yet
    }
  });

  for (const prompt of closedPrompts) {
    // Check worker availability
    const availability = await getWorkerAvailability(prompt.worker_id, prompt.window_closes_at);
    
    if (availability.status === 'available') {
      // Emit missed event
      await db.events.create({
        data: {
          event_id: uuid(),
          event_type: 'checkin.window_missed',
          event_time: prompt.window_closes_at,
          ingested_at: now,
          worker_id: prompt.worker_id,
          payload: {
            prompt_id: prompt.prompt_id,
            window_closed_at: prompt.window_closes_at,
            availability_snapshot: 'available',
            reason: 'no_submission'
          }
        }
      });
      
      // Update projection
      await db.prompts.update({
        where: { prompt_id: prompt.prompt_id },
        data: { status: 'missed' }
      });
    } else {
      // Worker was on leave/off-shift → excuse the prompt
      await db.prompts.update({
        where: { prompt_id: prompt.prompt_id },
        data: { 
          status: 'excused',
          excusal_reason: availability.status // 'on_leave', 'sick', 'off_shift'
        }
      });
    }
  }
}
```

---

### 5. Late Submission Handling 🔴 CRITICAL

#### Current V5:
```
If worker submits after window:
- Just creates check_in record as normal
- created_at shows when DB received it
- No indication this was late
- If missed_check_ins record exists, DELETE it or mark as "submitted_late"

Result: Lost the fact that window was missed
```

#### Required by Playbook:
```
Late submission = new event with is_late=true
Missed event STAYS in history

Timeline:
1. 06:05 AM - Window closes, no submission
   → Emit: checkin.window_missed (event_id_1)
   → Projection: prompt.status = 'missed'

2. 07:30 AM - Worker finally submits (1hr 25min late)
   → Emit: checkin.response_submitted (event_id_2)
     {
       is_late: true,
       late_by_seconds: 5100,
       submitted_at: "07:30:00"
     }
   → Projection: prompt.status = 'completed_late', response_id = event_id_2

3. Both events stay in events table forever
   → Complete audit trail
```

#### Impact:
**SEVERE** - Cannot track late patterns, audit trail incomplete, compliance calculations wrong

#### Why This Matters:
> Playbook: "Late submission never deletes missed history"

#### How to Fix:
```javascript
// When worker submits check-in
async function submitCheckIn(workerId, promptId, answers, submittedAt) {
  const prompt = await db.prompts.findUnique({ where: { prompt_id: promptId } });
  
  // Check if late
  const isLate = submittedAt > prompt.window_closes_at;
  const lateBySeconds = isLate 
    ? Math.floor((submittedAt - prompt.window_closes_at) / 1000) 
    : 0;
  
  // Create response event (ALWAYS append, never update)
  const responseEvent = await db.events.create({
    data: {
      event_id: uuid(),
      event_type: 'checkin.response_submitted',
      event_time: submittedAt, // ACTUAL submission time
      ingested_at: new Date(),
      worker_id: workerId,
      payload: {
        prompt_id: promptId,
        is_late: isLate,
        late_by_seconds: lateBySeconds,
        answers: answers
      }
    }
  });
  
  // Update projection (this is the ONLY update - never update events table)
  await db.prompts.update({
    where: { prompt_id: promptId },
    data: {
      status: isLate ? 'completed_late' : 'completed_on_time',
      response_id: responseEvent.event_id,
      last_updated: new Date()
    }
  });
  
  // NOTE: If there's a missed event from earlier, IT STAYS in events table
  // The projection (prompts.status) is what shows the reconciled state
}
```

---

### 6. No Baseline/Longitudinal Features 🔴 CRITICAL

#### Current V5:
```
Only stores raw scores:
- sleep_score: 85
- stress_score: 50
- physical_score: 60
- readiness_score: 74

No comparison to personal baseline
No deviation metrics
No trend tracking
```

#### Required by Playbook:
```
Must compute for EACH worker:

1. Baseline (rolling 28 days):
   - fatigue_baseline_median: 3.0 (Pedro's normal)
   - fatigue_mad: 0.5 (median absolute deviation)

2. Deviation scores:
   - fatigue_z_robust: (current - median) / (1.4826 * MAD)
   - Example: (7 - 3.0) / (1.4826 * 0.5) = 5.4

3. Trend:
   - 7d_slope: linear regression over last 7 days
   - 14d_slope: linear regression over last 14 days

4. Volatility:
   - rolling_std_14d: standard deviation over 14 days

5. Missingness:
   - missed_rate_7d: (missed / total) last 7 days
   - missed_rate_30d: (missed / total) last 30 days
```

#### Impact:
**SEVERE** - Cannot detect deviations from personal baseline, cannot identify risk patterns over time

#### Why This Matters:
> Playbook: "A worker always reporting 2/10 can still show risk if volatility rises"

This is about **stoic workers** - someone who always reports low (fatigue=2) might be hiding problems. But if their pattern changes (suddenly reporting 4-5), that's a **deviation** even though 4-5 is still "low" by absolute standards.

#### How to Fix:
```sql
-- Create feature_store table
CREATE TABLE feature_store (
  feature_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL,
  feature_name VARCHAR(100) NOT NULL, -- 'fatigue_z_robust', 'stress_baseline_median', etc.
  feature_value NUMERIC NOT NULL,
  window VARCHAR(20), -- '7d', '14d', '28d'
  version VARCHAR(20) NOT NULL, -- 'baseline_v1.0', 'feature_v2.1'
  metadata JSONB, -- baseline snapshot, computation details
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature_store_worker_time ON feature_store(tenant_id, worker_id, computed_at);
CREATE INDEX idx_feature_store_name ON feature_store(tenant_id, worker_id, feature_name);
```

```javascript
// Feature computation pipeline
async function computeFeaturesForWorker(workerId, responseEvent) {
  // Get last 28 days of responses
  const history = await getWorkerHistory(workerId, 28);
  
  // Compute baseline (robust median)
  const fatigueValues = history.map(r => r.payload.fatigue);
  const fatigueMedian = median(fatigueValues);
  const fatigueMAD = medianAbsoluteDeviation(fatigueValues);
  
  // Compute z-score for current value
  const currentFatigue = responseEvent.payload.fatigue;
  const fatigueZ = (currentFatigue - fatigueMedian) / (1.4826 * fatigueMAD + 0.001); // epsilon to avoid div by zero
  
  // Store baseline
  await db.feature_store.create({
    data: {
      worker_id: workerId,
      computed_at: responseEvent.event_time,
      feature_name: 'fatigue_baseline_median',
      feature_value: fatigueMedian,
      window: '28d',
      version: 'baseline_v1.0',
      metadata: {
        sample_size: fatigueValues.length,
        mad: fatigueMAD
      }
    }
  });
  
  // Store z-score
  await db.feature_store.create({
    data: {
      worker_id: workerId,
      computed_at: responseEvent.event_time,
      feature_name: 'fatigue_z_robust',
      feature_value: fatigueZ,
      window: 'current',
      version: 'feature_v1.0',
      metadata: {
        baseline: fatigueMedian,
        current: currentFatigue,
        deviation: currentFatigue - fatigueMedian
      }
    }
  });
  
  // Repeat for stress, pain, sleep...
}

// Helper functions
function median(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function medianAbsoluteDeviation(arr) {
  const med = median(arr);
  const deviations = arr.map(x => Math.abs(x - med));
  return median(deviations);
}
```

---

### 7. Risk Detection: Absolute Thresholds vs Deviation 🔴 CRITICAL

#### Current V5:
```
Uses absolute readiness score:
- readiness >= 75 → GREEN (ready for work)
- readiness 50-74 → YELLOW (modified duty)
- readiness < 50 → RED (needs attention)

Same threshold for EVERYONE
```

#### Problem:
```
Worker A (always reports high):
- Baseline: fatigue=2, stress=2, readiness=95
- Today: fatigue=5, stress=4, readiness=85
- System: ✅ GREEN (85 > 75)
- Reality: 🚨 MAJOR deviation from personal normal!

Worker B (stoic, always reports low):
- Baseline: fatigue=6, stress=7, readiness=65
- Today: fatigue=6, stress=7, readiness=65
- System: ⚠️ YELLOW (65 < 75)
- Reality: ✅ Normal for this person
```

#### Required by Playbook:
```
Use within-person deviations:

Rules (example):
1. HIGH severity:
   - fatigue_z > 2.5 OR
   - stress_z > 2.5 OR
   - pain_delta >= 3 OR
   - 2+ dimensions with z > 2.0

2. MEDIUM severity:
   - fatigue_z > 1.8 OR
   - (trend_slope_7d > threshold AND volatility rising)

3. Compliance risk:
   - missed_rate_7d > 0.4 AND worker availability = available
```

#### Impact:
**MAJOR** - Misses stoic workers (always report low but stable), flags normal variation

#### Why This Matters:
> Playbook: "Under-reporters: detect via within-person changes, not absolute thresholds"

#### How to Fix:
```javascript
// New risk scoring engine
async function computeRiskSignal(workerId, responseEvent, features) {
  const rules = {
    HIGH: [
      features.fatigue_z > 2.5,
      features.stress_z > 2.5,
      features.pain_delta >= 3,
      (features.fatigue_z > 2.0 && features.stress_z > 2.0) // 2+ dimensions elevated
    ],
    MEDIUM: [
      features.fatigue_z > 1.8,
      (features.trend_slope_7d > 0.5 && features.volatility_14d > 1.5)
    ]
  };
  
  let severity = 'LOW';
  let triggeredRules = [];
  
  // Check HIGH rules
  if (rules.HIGH.some(rule => rule)) {
    severity = 'HIGH';
    triggeredRules = rules.HIGH.map((rule, i) => rule ? `HIGH_${i}` : null).filter(Boolean);
  }
  // Check MEDIUM rules
  else if (rules.MEDIUM.some(rule => rule)) {
    severity = 'MEDIUM';
    triggeredRules = rules.MEDIUM.map((rule, i) => rule ? `MED_${i}` : null).filter(Boolean);
  }
  
  // Create risk signal event
  await db.events.create({
    data: {
      event_type: 'risk.signal_computed',
      event_time: responseEvent.event_time,
      worker_id: workerId,
      payload: {
        response_id: responseEvent.event_id,
        severity: severity,
        features: features,
        triggered_rules: triggeredRules,
        explanations: [
          {
            feature: 'fatigue_z',
            why: `Fatigue ${responseEvent.payload.fatigue} vs baseline ${features.fatigue_baseline}`
          }
        ],
        engine_version: 'ruleset_v3.2'
      }
    }
  });
  
  return { severity, triggeredRules };
}
```

---

## Part 2: Major Issues

### 1. No Risk Episodes/Signal Clustering 🟠 MAJOR

#### Current V5:
```
Each check-in evaluated independently
No concept of "episodes"

Example:
- Monday: fatigue=7, readiness=76 GREEN
- Tuesday: fatigue=7, readiness=75 GREEN
- Wednesday: fatigue=8, readiness=74 YELLOW

Each day is separate. System doesn't see this as a TREND.
```

#### Required by Playbook:
```
Cluster related risk signals into RiskEpisodes

Episode logic:
- Open episode if:
  * HIGH signal detected, OR
  * 2+ MEDIUM signals within 7 days, OR
  * Compliance risk sustained 2+ windows

- Close episode if:
  * No MEDIUM/HIGH signals for 14 days AND compliance normalizes, OR
  * Case resolved + outcome logged
```

#### How to Fix:
```sql
CREATE TABLE risk_episodes (
  episode_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'OPEN', 'MANAGED', 'RESOLVED', 'CLOSED'
  severity VARCHAR(20) NOT NULL, -- 'HIGH', 'MEDIUM'
  opened_at TIMESTAMPTZ NOT NULL,
  last_signal_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  signal_count INTEGER DEFAULT 1,
  duration_days INTEGER,
  resolution VARCHAR(100), -- 'intervention_successful', 'escalated', etc.
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```javascript
async function processRiskSignal(signal) {
  // Check for existing open episode
  let episode = await db.risk_episodes.findFirst({
    where: {
      worker_id: signal.worker_id,
      status: { in: ['OPEN', 'MANAGED'] }
    }
  });
  
  if (!episode) {
    // Open new episode if severity warrants it
    if (signal.severity === 'HIGH') {
      episode = await db.risk_episodes.create({
        data: {
          worker_id: signal.worker_id,
          status: 'OPEN',
          severity: signal.severity,
          opened_at: signal.event_time,
          signal_count: 1
        }
      });
    }
  } else {
    // Update existing episode
    await db.risk_episodes.update({
      where: { episode_id: episode.episode_id },
      data: {
        last_signal_at: signal.event_time,
        signal_count: { increment: 1 },
        severity: signal.severity // update to higher severity if needed
      }
    });
  }
  
  return episode;
}
```

---

### 2. No Availability/Off-Shift Tracking 🟠 MAJOR

#### Current V5:
```
Missed check-ins don't account for leave/off-shift
Everyone expected to check in every day

Problem:
- Worker on approved annual leave → still marked as "missed"
- Worker assigned to team today → penalized for not checking in before assignment
```

#### Required by Playbook:
```
worker.availability_set events:
- on_leave
- sick
- off_shift
- available

These events excuse prompts accordingly
```

#### How to Fix:
```sql
CREATE TABLE availability_events (
  availability_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'available', 'on_leave', 'sick', 'off_shift'
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ NOT NULL,
  reason TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```javascript
async function getWorkerAvailability(workerId, atTime) {
  const availability = await db.availability_events.findFirst({
    where: {
      worker_id: workerId,
      effective_from: { lte: atTime },
      effective_to: { gte: atTime }
    },
    orderBy: { created_at: 'desc' }
  });
  
  return availability?.status || 'available';
}

// When detecting missed check-ins
async function detectMissed(prompt) {
  const availability = await getWorkerAvailability(
    prompt.worker_id, 
    prompt.window_closes_at
  );
  
  if (availability === 'available') {
    // Emit missed event
    await emitMissedEvent(prompt);
  } else {
    // Excuse the prompt
    await db.prompts.update({
      where: { prompt_id: prompt.prompt_id },
      data: { 
        status: 'excused',
        excusal_reason: availability 
      }
    });
  }
}
```

---

### 3. No Feature Versioning/Explainability 🟠 MAJOR

#### Current V5:
```
Readiness scores calculated but:
- No version tracking
- No explanation stored
- Can't reproduce past decisions
```

#### Required by Playbook:
```
Every risk signal must store:
- Features used + values
- Baseline snapshot identifiers
- Rule/model version
- Human-readable reasons
```

#### How to Fix:
```sql
CREATE TABLE decision_log (
  decision_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  decision_type VARCHAR(50) NOT NULL, -- 'risk_signal', 'episode_opened', 'case_created'
  decision_time TIMESTAMPTZ NOT NULL,
  decision_data JSONB NOT NULL,
  version_info JSONB NOT NULL, -- rule version, feature version, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```javascript
async function logRiskDecision(signal, features, ruleVersion) {
  await db.decision_log.create({
    data: {
      worker_id: signal.worker_id,
      decision_type: 'risk_signal',
      decision_time: signal.event_time,
      decision_data: {
        severity: signal.severity,
        features_used: features,
        triggered_rules: signal.triggered_rules,
        explanations: [
          `Fatigue ${signal.payload.fatigue} vs baseline ${features.fatigue_baseline}`,
          `Z-score: ${features.fatigue_z.toFixed(2)} (threshold: 2.5)`
        ]
      },
      version_info: {
        rule_version: ruleVersion,
        feature_version: 'v1.0',
        baseline_window: '28d'
      }
    }
  });
}
```

---

## Part 3: Real-World Scenarios

### Scenario 1: Worker Submits Check-in Late

**Worker:** Juan - Construction Worker, Morning Shift

#### Timeline:

**05:30 AM - Shift starts at 6:00 AM**

V5 Current:
```
State: No data yet
Database: Nothing in check_ins table
Logic: Waiting for submission
```

Playbook Required:
```
State: Prompt scheduled
Database:
  events table:
  {
    event_type: "checkin.prompt_scheduled",
    prompt_id: "pr_001",
    shift_id: "sh_001",
    window: {
      opens_at: "2026-02-12T05:15:00+08:00",
      closes_at: "2026-02-12T06:05:00+08:00"
    },
    prompt_kind: "pre_shift"
  }
  
  prompts table:
  {
    prompt_id: "pr_001",
    worker_id: "juan",
    status: "scheduled"
  }
```

---

**06:05 AM - Check-in window CLOSES (Juan hasn't submitted yet)**

V5 Current:
```
State: No data yet
Database: Still nothing in check_ins table
Logic:
  Background job runs at 06:07 AM:
  - Query: SELECT * FROM check_ins WHERE worker_id='juan' AND date=today
  - Result: No rows found
  - Creates missed_check_ins record
  - Marks as MISSED based on absence
```

Playbook Required:
```
State: Window missed - EXPLICIT EVENT
Database:
  events table (NEW EVENT):
  {
    event_id: "evt_miss_001",
    event_type: "checkin.window_missed",
    event_time: "2026-02-12T06:05:00+08:00",
    prompt_id: "pr_001",
    worker_id: "juan",
    payload: {
      window_closed_at: "2026-02-12T06:05:00+08:00",
      availability_snapshot: "available",
      reason: "no_submission"
    }
  }
  
  prompts table (UPDATED VIA PROJECTION):
  {
    prompt_id: "pr_001",
    status: "missed",
    last_updated: "2026-02-12T06:05:00+08:00"
  }

Logic: System emits explicit missed event. Current state = projection from events.
```

---

**07:30 AM - Juan finally checks in (1 hour 25 mins LATE)**

V5 Current:
```
State: Check-in recorded
Database:
  check_ins table (INSERT):
  {
    id: 1,
    worker_id: "juan",
    check_in_date: "2026-02-12",
    created_at: "2026-02-12 07:30:00",  // ← Database timestamp
    fatigue: 7,
    stress: 5,
    readiness_score: 65
  }
  
  missed_check_ins table (DELETE):
  - Deletes the missed record OR updates status to "submitted_late"

Problems:
❌ Lost the fact that he missed the window
❌ created_at shows DB time, not when Juan actually submitted
❌ No indication this was late
❌ If we delete missed record → audit trail gone
❌ Compliance calculation: did he comply or not? Unclear.
```

Playbook Required:
```
State: Late submission recorded, missed event PRESERVED
Database:
  events table (NEW EVENT - missed stays!):
  {
    event_id: "evt_resp_001",
    event_type: "checkin.response_submitted",
    event_time: "2026-02-12T07:30:00+08:00",  // ← Juan's submission time
    ingested_at: "2026-02-12T07:30:02+08:00",  // ← Server received time
    prompt_id: "pr_001",
    worker_id: "juan",
    is_late: true,
    late_by_seconds: 5100,  // 1hr 25min
    payload: {
      fatigue: 7,
      stress: 5,
      submitted_at: "2026-02-12T07:30:00+08:00"
    }
  }
  
  prompts table (UPDATED VIA PROJECTION):
  {
    prompt_id: "pr_001",
    status: "completed_late",  // ← reconciled state
    response_id: "evt_resp_001",
    last_updated: "2026-02-12T07:30:00+08:00"
  }
  
  BOTH events stay in events table:
  1. checkin.window_missed (06:05 AM)
  2. checkin.response_submitted (07:30 AM, is_late=true)

Benefits:
✅ Complete audit trail (missed + late both recorded)
✅ event_time shows ACTUAL submission time
✅ is_late flag explicitly marks this
✅ Compliance: counts as "late completion" not "missed"
✅ Can analyze late patterns: "Juan late 3x this week"
✅ Can reproduce: "At 6:07 AM, he was marked missed. At 7:30 AM, he submitted late."
```

---

### Scenario 2: Worker on Approved Leave

**Worker:** Maria - Warehouse Worker, on Annual Leave Feb 10-14

#### Timeline:

**Feb 10, 8:00 AM - Maria applies for leave (approved by supervisor)**

V5 Current:
```
State: Leave recorded somewhere (maybe separate table)
Database:
  leaves table:
  {
    worker_id: "maria",
    start_date: "2026-02-10",
    end_date: "2026-02-14",
    status: "approved"
  }

Problem: check_ins system doesn't know about this
Logic: Leave system and check-in system are separate. No integration.
```

Playbook Required:
```
State: Availability event emitted
Database:
  events table:
  {
    event_type: "worker.availability_set",
    event_time: "2026-02-10T08:00:00+11:00",
    worker_id: "maria",
    payload: {
      status: "on_leave",
      effective_from: "2026-02-10T00:00:00+11:00",
      effective_to: "2026-02-14T23:59:59+11:00",
      reason: "Annual leave"
    }
  }

Logic: Single event log knows about availability changes
```

---

**Feb 12, 6:05 AM - Check-in window closes (Maria is on leave)**

V5 Current:
```
State: Incorrectly marked as MISSED
Database:
  missed_check_ins:
  {
    worker_id: "maria",
    missed_date: "2026-02-12",
    created_at: "2026-02-12 06:07:00"
  }
  
  Background job doesn't check leave status
  → Maria gets penalized for being on approved leave!

Problems:
❌ Compliance rate drops unfairly
❌ Maria gets "missed check-in" notification (annoying)
❌ Team leader sees Maria as non-compliant
❌ Metrics wrong: "80% compliance" but should be "100% (excluding leave)"
```

Playbook Required:
```
State: Prompt excused automatically
Database:
  events table:
  1. worker.availability_set (on_leave from Feb 10-14)
  2. checkin.prompt_scheduled (for Feb 12)
  
  Reconciliation logic:
  - Query: Is Maria available on Feb 12?
  - Answer: No, on_leave from Feb 10-14
  - Action: Mark prompt as "excused"
  
  prompts table (PROJECTION):
  {
    prompt_id: "pr_maria_feb12",
    status: "excused",  // ← not "missed"
    excusal_reason: "on_leave"
  }
  
  NO missed event emitted because worker unavailable

Benefits:
✅ Maria not penalized for approved leave
✅ Compliance calc: (completed + late) / (total - excused)
✅ Team leader sees "Maria: On Leave (Excused)"
✅ Metrics accurate: "100% compliance (2 completed, 1 excused)"
✅ Audit trail shows: prompted → excused due to availability
```

---

### Scenario 3: Detecting Fatigue Risk Over Time

**Worker:** Pedro - Forklift Operator, normally reports fatigue=3, this week reporting 7-8

#### Timeline:

**Week of Jan 1-7 - Pedro's normal baseline (2 weeks of data)**

V5 Current:
```
State: Historical check-ins stored
Database:
  check_ins table:
  Jan 1: fatigue=3, stress=2, readiness=85
  Jan 2: fatigue=3, stress=3, readiness=83
  Jan 3: fatigue=4, stress=2, readiness=82
  Jan 4: fatigue=3, stress=3, readiness=85
  Jan 5: fatigue=3, stress=2, readiness=84
  
  Average fatigue: 3.2
  Readiness threshold: 75 (GREEN if above)

Logic: System just stores scores. No baseline calculation.
```

Playbook Required:
```
State: Baseline computed automatically
Database:
  feature_store table:
  {
    worker_id: "pedro",
    computed_at: "2026-01-07",
    window: "28d",
    features: {
      fatigue_baseline_median: 3.0,
      fatigue_mad: 0.5,  // median absolute deviation
      stress_baseline_median: 2.5,
      stress_mad: 0.4,
      readiness_baseline_median: 84.0
    },
    version: "baseline_v1.0"
  }

Logic: Rolling 28-day baseline per worker per metric. 
       Baseline = personal normal, not absolute.
```

---

**Feb 10, Monday - Pedro reports fatigue=7 (unusual for him)**

V5 Current:
```
State: Score recorded, readiness still GREEN
Database:
  check_ins:
  {
    date: "2026-02-10",
    fatigue: 7,
    stress: 3,
    readiness_score: 76  // ← Still above 75, so GREEN
  }
  
  Dashboard shows: Pedro ✅ GREEN (76/100)

Problems:
❌ System doesn't know this is unusual for Pedro
❌ Absolute threshold (75) missed the risk
❌ Pedro always reports low, so 7 is HUGE for him
❌ No alert triggered because 76 > 75
```

Playbook Required:
```
State: Risk signal detected via deviation
Database:
  events table:
  {
    event_type: "checkin.response_submitted",
    payload: { fatigue: 7, stress: 3 }
  }
  
  Feature computation:
  {
    fatigue_current: 7,
    fatigue_baseline: 3.0,
    fatigue_z_robust: (7 - 3.0) / (1.4826 * 0.5) = 5.4  // ← MAJOR deviation!
    
    Rule triggered: fatigue_z > 2.5 → HIGH severity
  }
  
  risk_signals table:
  {
    signal_id: "sig_001",
    worker_id: "pedro",
    severity: "HIGH",
    features: {
      fatigue_z: 5.4,
      fatigue_delta: +4
    },
    explanations: [
      "Fatigue 7 vs personal baseline 3.0",
      "Deviation: 5.4 standard deviations above normal"
    ]
  }

Benefits:
✅ Catches stoic workers (Pedro always reports low)
✅ Deviation-based detection (not absolute)
✅ Explainable: "5.4 SD above HIS normal"
✅ Alert triggered even though absolute score isn't "bad"
```

---

**Feb 11-12, Tue-Wed - Pedro continues reporting high fatigue (7, 8)**

V5 Current:
```
State: Individual check-ins, no pattern detection
Database:
  check_ins:
  Feb 10: fatigue=7, readiness=76 GREEN
  Feb 11: fatigue=7, readiness=75 GREEN
  Feb 12: fatigue=8, readiness=74 YELLOW
  
  Each day evaluated independently

Problems:
❌ System doesn't see this as a TREND
❌ No concept of "sustained risk"
❌ Each check-in isolated
❌ Feb 12 triggers YELLOW, but Feb 10-11 ignored
```

Playbook Required:
```
State: Risk episode opened (cluster of signals)
Database:
  risk_signals:
  Feb 10: fatigue_z=5.4, severity=HIGH
  Feb 11: fatigue_z=5.6, severity=HIGH
  Feb 12: fatigue_z=6.1, severity=HIGH
  
  Episode logic triggered:
  "2+ HIGH signals within 7 days" → Open episode
  
  risk_episodes:
  {
    episode_id: "ep_pedro_001",
    worker_id: "pedro",
    status: "OPEN",
    severity: "HIGH",
    opened_at: "2026-02-11",  // after 2nd signal
    signal_count: 3,
    duration_days: 2,
    reason: "Sustained fatigue elevation vs baseline"
  }
  
  case_management:
  {
    case_id: "case_001",
    episode_id: "ep_pedro_001",
    assigned_to: "supervisor_001",
    action_required: "Check-in with worker",
    status: "OPEN"
  }

Benefits:
✅ Detects PATTERN not just individual days
✅ Episode tracking: "Risk ongoing for 3 days"
✅ Case opened automatically
✅ Supervisor gets: "Pedro needs attention - sustained fatigue"
✅ NOT just "Pedro scored 74 today"
```

---

**Feb 13, Thursday - Supervisor talks to Pedro, discovers he's not sleeping well (newborn baby)**

V5 Current:
```
State: Supervisor manually notes in system (maybe)
Database: Maybe adds a comment somewhere? No structured workflow.
Logic: Manual intervention, no tracking
```

Playbook Required:
```
State: Case action logged with outcome
Database:
  case_actions:
  {
    case_id: "case_001",
    action_type: "supervisor_intervention",
    action_time: "2026-02-13T10:00:00",
    notes: "Spoke with Pedro. Newborn baby, not sleeping. Offered modified duties.",
    outcome: "assigned_light_duties"
  }
  
  risk_episodes:
  {
    episode_id: "ep_pedro_001",
    status: "MANAGED",  // still open but action taken
    last_action_at: "2026-02-13T10:00:00"
  }

Benefits:
✅ Complete workflow tracked
✅ Outcome recorded: root cause identified
✅ Can analyze: "How long from signal to intervention?" (3 days)
✅ Can track: "Did intervention work?"
```

---

**Feb 14-20 - Pedro on light duties, fatigue improves to 4-5**

V5 Current:
```
State: Scores improve, back to GREEN
Database:
  check_ins:
  Feb 14: fatigue=5, readiness=80 GREEN
  Feb 15: fatigue=4, readiness=82 GREEN
  ...

Logic: System doesn't know intervention worked. Just sees GREEN again.
```

Playbook Required:
```
State: Episode closes, outcome tracked
Database:
  risk_signals:
  Feb 14: fatigue_z=2.1, severity=MEDIUM (improving)
  Feb 15: fatigue_z=1.0, severity=LOW
  Feb 16-20: fatigue_z < 2.0, normal range
  
  Episode closure logic:
  "No HIGH/MEDIUM signals for 7 days" → Close episode
  
  risk_episodes:
  {
    episode_id: "ep_pedro_001",
    status: "RESOLVED",
    closed_at: "2026-02-20",
    duration_total_days: 10,
    resolution: "Intervention successful - light duties",
    outcome: "no_incident_prevented"
  }
  
  decision_log:
  {
    episode_id: "ep_pedro_001",
    timeline: [
      "Feb 10: First HIGH signal (fatigue_z=5.4)",
      "Feb 11: Episode opened (2nd HIGH signal)",
      "Feb 13: Supervisor intervention",
      "Feb 20: Episode closed (7 days normal)"
    ],
    intervention_effectiveness: "successful"
  }

Benefits:
✅ Complete episode lifecycle tracked
✅ Can measure: "Intervention worked in 7 days"
✅ Analytics: "Average episode duration: 10 days"
✅ Can prove ROI: "Prevented potential incident"
✅ Learn: "Light duties effective for fatigue issues"
```

---

### Scenario 4: Multi-Timezone Company

**Workers:** Alice (Perth, UTC+8) and Bob (Sydney, UTC+11)

V5 Current:
```
All timestamps in single timezone (Asia/Manila)

check_ins:
Alice (Perth): check_in_date="2026-02-12", created_at="2026-02-12 06:00:00"
Bob (Sydney): check_in_date="2026-02-12", created_at="2026-02-12 09:00:00"

Problem: Both show "6:00 AM" and "9:00 AM" but in what timezone?

Problems:
❌ Can't tell if Alice checked in early or late
❌ Bob's time looks wrong (9 AM for 6 AM shift?)
❌ Compliance windows wrong for remote workers
❌ Reports show wrong times for each location
```

Playbook Required:
```
Every event has timezone, computed in local time

shifts:
{
  shift_id: "sh_alice",
  worker_id: "alice",
  timezone: "Australia/Perth",
  start_time: "2026-02-12T06:00:00+08:00"
}
{
  shift_id: "sh_bob",
  worker_id: "bob",
  timezone: "Australia/Sydney",
  start_time: "2026-02-12T06:00:00+11:00"
}

events (with timezone):
{
  event_type: "checkin.response_submitted",
  worker_id: "alice",
  event_time: "2026-02-12T05:45:00+08:00",  // 5:45 AM Perth
  timezone: "Australia/Perth"
}
{
  event_type: "checkin.response_submitted",
  worker_id: "bob",
  event_time: "2026-02-12T05:58:00+11:00",  // 5:58 AM Sydney
  timezone: "Australia/Sydney"
}

Benefits:
✅ Each worker's time in THEIR timezone
✅ Windows computed correctly: Perth 5:15-6:05 vs Sydney 5:15-6:05
✅ "Late" detection works per timezone
✅ Reports show local times correctly
✅ Supports global operations
```

---

## Summary: V5 vs Playbook

### What V5 Answers:
- "Did they check in today?"
- "What score did they get?"
- "Who missed check-in?"

### What Playbook Answers:
- "Is this worker deviating from their personal baseline?"
- "Is this a pattern or one-off?"
- "What intervention worked?"
- "Can we predict risk before incident?"

### Bottom Line:

**V5 = Survey Storage Tool**
✅ Good for daily compliance tracking
✅ Good for basic reporting
❌ Not longitudinal
❌ Not predictive
❌ Not enterprise-grade

**Playbook = Risk Prediction Infrastructure**
✅ Event-sourced (complete audit trail)
✅ Time-aware (event_time, timezones)
✅ Longitudinal (baselines, trends, episodes)
✅ Explainable (decision logs, feature versions)
✅ Predictive (deviation-based risk detection)

---

## Migration Roadmap

### Phase 1: Event Foundation (Week 1-2)
- [ ] Create `events` table with event_id, event_type, event_time, timezone, payload
- [ ] Create `shifts` and `prompts` tables
- [ ] Implement event ingestion API with idempotency
- [ ] Migrate existing check_ins to event format
- [ ] Update all API endpoints to emit events instead of direct DB writes

### Phase 2: Missed Detection + Projections (Week 3)
- [ ] Implement window close job that emits `checkin.window_missed` events
- [ ] Create `prompts` projection table (status: scheduled/completed_on_time/late/missed/excused)
- [ ] Handle late submissions properly (is_late flag, preserve missed events)
- [ ] Add `availability_events` for leave/off-shift tracking
- [ ] Update compliance calculations to exclude excused prompts

### Phase 3: Longitudinal Features (Week 4)
- [ ] Create `feature_store` table
- [ ] Implement baseline engine (28d rolling median + MAD)
- [ ] Compute z-scores, trend slopes, volatility, missingness per worker
- [ ] Store feature versions and baseline snapshots
- [ ] Build async feature computation pipeline

### Phase 4: Risk Engine + Episodes (Week 5-6)
- [ ] Replace absolute thresholds with z-score rules
- [ ] Create `risk_episodes` table and clustering logic
- [ ] Add `decision_log` for explainability
- [ ] Update dashboards to show episode-based risk
- [ ] Implement case management linked to episodes
- [ ] Build reports showing episode outcomes and intervention effectiveness

### Phase 5: Hardening (Week 7-8)
- [ ] Add schema versioning for forms and algorithms
- [ ] Implement stream processor for async event handling
- [ ] Build audit export with raw + derived + explanations
- [ ] Performance testing with 10,000+ daily check-ins
- [ ] Documentation and training materials

---

## Key Principles to Remember

1. **Event-Time First** - Always use `event_time` (when it happened) not `ingested_at` (when received)

2. **Append-Only** - Never UPDATE or DELETE events. Current state = projection from events.

3. **Explicit Everything** - Missed check-ins are events, not inferences. Late submissions are flagged, not implied.

4. **Personal Baselines** - Compare to individual's history, not absolute thresholds.

5. **Episode Thinking** - Cluster signals into episodes. Track lifecycle, not just individual flags.

6. **Explainability** - Every decision must have: features used, baseline snapshot, version, human-readable reason.

7. **Timezone Aware** - All timestamps with timezone. Compute windows in worker's local time.

---

End of Document
