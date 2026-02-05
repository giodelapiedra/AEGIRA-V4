# Missed Check-In State Snapshot - Detailed Explanation

## Overview

Kapag may missed check-in, kailangan natin i-capture ang **complete state** ng worker sa exact moment na na-detect ang miss. Bakit? Kasi hindi mo na ma-reconstruct ang state na yan pagkatapos ng ilang araw o linggo.

---

## Current Data Structure (Ngayon)

### Ano ang na-save sa database:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "company_id": "company-123",
  "person_id": "juan-123",
  "team_id": "night-shift-team-a",
  "missed_date": "2026-02-01T00:00:00.000Z",
  "status": "OPEN",
  "schedule_window": "10:00 PM - 2:00 AM",
  "notes": null,
  "resolved_by": null,
  "resolved_at": null,
  "created_at": "2026-02-01T10:15:30.000Z",
  "updated_at": "2026-02-01T10:15:30.000Z"
}
```

**Problem:**
- Basic info lang (who, when, which team)
- Walang context kung ano ang state ni Juan nung nag-miss siya
- Hindi mo na alam kung first miss o part ng pattern
- Hindi mo na alam kung declining readiness o anomaly lang

---

## Proposed Data Structure (With State Snapshot)

### Ano ang dapat ma-save:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "company_id": "company-123",
  "person_id": "juan-123",
  "team_id": "night-shift-team-a",
  "missed_date": "2026-02-01T00:00:00.000Z",
  "status": "OPEN",
  "schedule_window": "10:00 PM - 2:00 AM",
  "notes": null,
  "resolved_by": null,
  "resolved_at": null,
  "created_at": "2026-02-01T10:15:30.000Z",
  "updated_at": "2026-02-01T10:15:30.000Z",
  
  // ===== STATE SNAPSHOT (NEW!) =====
  "worker_role_at_miss": "WORKER",
  "day_of_week": 6,                    // Saturday (0=Sun, 6=Sat)
  "week_of_month": 1,                  // First week of February
  "days_since_last_check_in": 1,       // Last checked in yesterday
  "days_since_last_miss": null,         // First miss ever (no previous miss)
  "check_in_streak_before": 31,        // 31 consecutive days before this miss
  "recent_readiness_avg": 78.5,        // Average readiness last 7 days
  "misses_in_last_30d": 0,             // No misses in last 30 days
  "misses_in_last_60d": 0,             // No misses in last 60 days
  "misses_in_last_90d": 0,             // No misses in last 90 days
  "baseline_completion_rate": 100.0,  // Perfect until today
  "is_first_miss_in_30d": true,        // First miss in 30 days
  "is_increasing_frequency": false,    // Not a pattern yet (first miss)
  "reminder_sent": true,                // Reminder was sent
  "reminder_failed": false              // Reminder sent successfully
}
```

---

## Real-World Scenarios

### Scenario 1: First Miss (Perfect Worker)

**Juan - Perfect worker, first miss:**

```sql
-- Database record:
id: 'abc-123'
person_id: 'juan-123'
missed_date: '2026-02-01'
status: 'OPEN'

-- STATE SNAPSHOT:
worker_role_at_miss: 'WORKER'
day_of_week: 6                          -- Saturday
week_of_month: 1                         -- First week
check_in_streak_before: 31              -- 31 days perfect!
recent_readiness_avg: 78.5               -- Was doing well
misses_in_last_30d: 0                   -- First miss
is_first_miss_in_30d: true              -- Pattern indicator
is_increasing_frequency: false           -- Not a pattern yet
```

**Meaning:** Worker na consistent, first miss. Possible anomaly.

**Risk Level:** Low (anomaly, not pattern)

---

### Scenario 2: Recurring Miss (Pattern)

**Maria - Multiple misses, declining:**

```sql
-- Database record:
id: 'def-456'
person_id: 'maria-456'
missed_date: '2026-02-10'
status: 'OPEN'

-- STATE SNAPSHOT:
worker_role_at_miss: 'WORKER'
day_of_week: 1                          -- Monday
week_of_month: 2                         -- Second week
check_in_streak_before: 4                -- Only 4 days streak (broken)
recent_readiness_avg: 45.2              -- Declining (was 70+ before)
misses_in_last_30d: 2                   -- This is 3rd miss
misses_in_last_60d: 5                   -- 5 misses in 2 months
is_first_miss_in_30d: false             -- Not first
is_increasing_frequency: true            -- Pattern: 0→1→2→3 misses
```

**Meaning:** Pattern ng misses, declining readiness. Higher risk.

**Risk Level:** High (clear pattern, declining)

---

### Scenario 3: Comparison Table

| Field | Juan (First Miss) | Maria (Pattern) | Pedro (Occasional) |
|-------|-------------------|-----------------|---------------------|
| `missed_date` | 2026-02-01 | 2026-02-10 | 2026-02-15 |
| `check_in_streak_before` | **31** | 4 | 12 |
| `recent_readiness_avg` | **78.5** | 45.2 | 65.0 |
| `misses_in_last_30d` | **0** | 2 | 1 |
| `is_first_miss_in_30d` | **true** | false | false |
| `is_increasing_frequency` | **false** | true | false |
| **Risk Level** | Low (anomaly) | High (pattern) | Medium |

---

## Why State Matters: Timeline Example

```
Timeline ng Events:

Jan 1-31: Juan checks in every day
  ├─ Streak: 31 days ✅
  ├─ Readiness: 75-82 (good)
  └─ Misses: 0

Feb 1, 10:15 AM: System detects miss
  ├─ CURRENT SYSTEM: Saves basic info only
  │   └─ ❌ Loses: streak, readiness, pattern
  │
  └─ WITH STATE: Saves everything
      ├─ ✅ Streak: 31 days
      ├─ ✅ Readiness avg: 78.5
      ├─ ✅ Day: Saturday (6)
      └─ ✅ Pattern: First miss

Feb 2-14: Juan continues working
  ├─ Checks in most days
  └─ Has 2 more misses (Feb 5, Feb 10)

Feb 15: Incident occurs
  └─ Back injury reported

Feb 20: Juan gets promoted
  ├─ Role: WORKER → TEAM_LEAD
  ├─ Team: Night Shift → Day Shift
  └─ ❌ CANNOT RECONSTRUCT Feb 1 state anymore!
```

**Key Point:** Once Juan gets promoted or changes teams, you can't reconstruct what his state was on Feb 1. The state snapshot preserves that moment forever.

---

## Query Examples (What You Can Do With State)

### Query 1: Find High-Risk Patterns

```sql
SELECT * FROM missed_check_ins
WHERE 
  check_in_streak_before >= 30        -- Had long streak
  AND recent_readiness_avg >= 75       -- Was doing well
  AND is_first_miss_in_30d = true      -- First miss
  AND day_of_week = 6                  -- Saturday night shift

-- Result: Juan's record
-- Meaning: "Perfect workers who miss on Saturday nights"
```

**Use Case:** Find anomalies - workers who are usually perfect but suddenly miss.

---

### Query 2: Find Declining Workers

```sql
SELECT * FROM missed_check_ins
WHERE 
  recent_readiness_avg < 50            -- Low readiness
  AND misses_in_last_30d >= 2          -- Multiple misses
  AND is_increasing_frequency = true   -- Pattern emerging

-- Result: Maria's record
-- Meaning: "Workers showing concerning pattern"
```

**Use Case:** Identify workers who need intervention - clear pattern of decline.

---

### Query 3: Correlate With Incidents

```sql
SELECT mci.*, i.incident_type, i.severity
FROM missed_check_ins mci
JOIN incidents i ON i.reporter_id = mci.person_id
WHERE 
  mci.check_in_streak_before >= 30
  AND i.created_at BETWEEN mci.missed_date 
      AND mci.missed_date + INTERVAL '14 days'

-- Result: Shows if workers with long streaks who miss
--         have incidents within 14 days
```

**Use Case:** Answer the question: "Do workers with 30+ day streaks who miss on Saturday nights have incidents within 14 days?"

**Answer:** "Yes, 60% of workers with this exact pattern had incidents. Alert system should flag this."

---

## Field Descriptions

### Contextual Snapshot Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `worker_role_at_miss` | Role? | Worker's role at detection time (can change later) | `"WORKER"` |
| `day_of_week` | Int | Day of week (0=Sun, 6=Sat) | `6` (Saturday) |
| `week_of_month` | Int | Which week of month (1-5) | `1` (First week) |
| `days_since_last_check_in` | Int? | Days since last check-in (null if first ever) | `1` |
| `days_since_last_miss` | Int? | Days since last miss (null if first miss) | `null` |
| `check_in_streak_before` | Int | Consecutive days before this miss | `31` |
| `recent_readiness_avg` | Float? | Average readiness last 7 days (null if <7 days) | `78.5` |
| `misses_in_last_30d` | Int | Count of misses in last 30 days | `0` |
| `misses_in_last_60d` | Int | Count of misses in last 60 days | `0` |
| `misses_in_last_90d` | Int | Count of misses in last 90 days | `0` |
| `baseline_completion_rate` | Float | % completion rate since assignment | `100.0` |

### Pattern Indicator Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `is_first_miss_in_30d` | Boolean | First miss in 30 days? | `true` |
| `is_increasing_frequency` | Boolean | Part of increasing pattern? | `false` |

### System State Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `reminder_sent` | Boolean | Was reminder sent? | `true` |
| `reminder_failed` | Boolean | Did reminder send fail? | `false` |

---

## Visual Comparison

### Current (Walang State):
```
┌─────────────────────────────────┐
│ MissedCheckIn Record            │
├─────────────────────────────────┤
│ person_id: juan-123             │
│ team_id: night-shift-team-a     │
│ missed_date: 2026-02-01        │
│ schedule_window: "10PM-2AM"    │
│ status: OPEN                    │
└─────────────────────────────────┘

❌ Walang context
❌ Hindi mo alam kung first miss o pattern
❌ Hindi mo alam kung declining ba o anomaly
```

### Proposed (May State):
```
┌─────────────────────────────────┐
│ MissedCheckIn Record            │
├─────────────────────────────────┤
│ person_id: juan-123             │
│ team_id: night-shift-team-a     │
│ missed_date: 2026-02-01        │
│ schedule_window: "10PM-2AM"     │
│ status: OPEN                    │
├─────────────────────────────────┤
│ STATE SNAPSHOT:                 │
│ • Streak: 31 days ✅            │
│ • Readiness: 78.5 (good) ✅     │
│ • First miss: Yes ✅            │
│ • Pattern: No (anomaly) ✅     │
│ • Day: Saturday night ✅        │
└─────────────────────────────────┘

✅ Complete context
✅ Puwede mong i-analyze ang pattern
✅ Puwede mong i-predict ang risk
```

---

## Implementation Flow

### Step 1: Detection Happens
```
Feb 1, 10:15 AM
System detects: Juan missed check-in
```

### Step 2: Calculate State (NEW!)
```
Before saving, system queries:
1. Juan's check-in history (last 90 days)
2. Juan's missed check-in history (last 90 days)
3. Juan's role and team assignment
4. Calculate streak, readiness, patterns
```

### Step 3: Save With State
```
Save to database:
- Basic info (person_id, team_id, date)
- State snapshot (streak, readiness, patterns)
```

### Step 4: Later Analysis
```
2 weeks later:
- Query: "Workers with 30+ streak who missed on Saturday"
- Correlate with incidents
- Find patterns
```

---

## Key Questions This Enables

1. **"Do workers with long streaks who miss have incidents?"**
   - Query: `check_in_streak_before >= 30` + correlate with incidents

2. **"Is this a pattern or anomaly?"**
   - Query: `is_first_miss_in_30d` vs `is_increasing_frequency`

3. **"Do Saturday night misses correlate with incidents?"**
   - Query: `day_of_week = 6` + correlate with incidents

4. **"Are workers with declining readiness missing more?"**
   - Query: `recent_readiness_avg < 50` + `misses_in_last_30d >= 2`

5. **"What's the time window from miss to incident?"**
   - Query: `missed_date` vs `incident.created_at` (within 14 days)

---

## Summary

**Current System:**
- Saves basic info only
- Cannot reconstruct state later
- Cannot analyze patterns
- Cannot predict risk

**Proposed System:**
- Saves basic info + complete state snapshot
- Preserves state forever
- Enables pattern analysis
- Enables risk prediction

**Bottom Line:**
Kapag nag-miss ang worker, i-save ang lahat ng context sa moment na na-detect. Hindi mo na ma-reconstruct yan pagkatapos, pero kailangan mo yan para sa risk prediction.

---

## Next Steps

1. Add fields to Prisma schema
2. Create migration
3. Update detection logic to calculate state
4. Update repository to save state
5. Test with real scenarios
6. Build analytics queries

---

*Last Updated: 2026-02-05*
