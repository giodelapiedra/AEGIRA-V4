# Case Risk Analysis - Feature Specification

**Date**: 2026-02-15
**Status**: Planned
**Phase**: 3a (between Phase 3 Availability and Phase 4 Baselines)

---

## Objective

When a worker has an incident that becomes an active Case, the system automatically analyzes their daily check-in history (14 days prior) and surfaces risk patterns, declining trends, and contributing factors. This gives WHS officers immediate context during case investigation — no manual data digging required.

## Problem

Currently, check-in data and incident/case data are completely disconnected. When a WHS officer opens a case:

- They see the incident report (type, severity, description)
- They see the reporter's basic info (name, team, email)
- They do **NOT** see the worker's recent readiness data
- They cannot identify if there were warning signs before the incident
- They have no way to correlate check-in patterns with the incident

## Solution

Add a **Risk Analysis** section to the Case Detail page that:

1. Fetches the reporter's check-in data for 14 days before the incident
2. Runs a **rule-based analysis algorithm** (no LLM, no external API) to detect risk patterns
3. Displays a structured summary with identified risk factors
4. Shows the raw check-in history table for manual review

---

## User Stories

### WHS Officer

> As a WHS officer investigating a case, I want to see the worker's recent check-in patterns so I can identify contributing factors to the incident.

**Acceptance Criteria:**
- On the Case Detail page, a "Risk Analysis" section appears below the existing case info cards
- The section shows: overall trend, average readiness, readiness level distribution
- Detected risk factors are listed with severity (HIGH/MEDIUM/LOW), category, and explanation
- The lowest-scoring check-in category is highlighted
- A table shows the full 14-day check-in history with all scores
- If the worker has no check-ins in the period, a "No check-in data available" message is shown

### Admin

> As an admin, I want the same risk analysis view as WHS officers when viewing case details.

### Worker

> As the worker who reported the incident, I can view the risk analysis on my own case (read-only) to understand what patterns were identified.

---

## Data Flow

```
Case Detail Page loads
    |
    v
Frontend calls GET /cases/:id/risk-analysis
    |
    v
Backend:
    1. Verify case access (same rules as GET /cases/:id)
    2. Get case → incident → reporter person_id
    3. Calculate date range: incident.created_at - 14 days → incident.created_at
    4. Query check-ins for reporter in date range
    5. Run analyzeCheckInRisk() algorithm
    6. Return RiskAnalysis response
    |
    v
Frontend renders RiskAnalysisPanel:
    - Summary card (trend, averages, level counts)
    - Risk factors list (sorted by severity)
    - Lowest category indicator
    - Check-in history table
```

---

## Risk Analysis Algorithm

### Input

Array of check-in records for the 14-day period, each containing:
- `readiness_score` (0-100), `readiness_level` (GREEN/YELLOW/RED)
- `sleep_score` (0-100), `hours_slept` (float)
- `stress_score` (0-100), `stress_level` (1-10)
- `physical_score` (0-100), `physical_condition` (1-10)
- `pain_score` (0-100 or null), `pain_level` (0-10 or null), `pain_location` (string or null)

### Detection Rules

| # | Rule | Severity | Condition | Example Output |
|---|------|----------|-----------|----------------|
| 1 | Consecutive RED days | HIGH | 3+ consecutive days with readiness < 50 | "Worker had 4 consecutive RED readiness days (Feb 10-13) immediately before the incident" |
| 2 | Declining trend | HIGH | Second-half avg is 15+ points lower than first-half avg | "Readiness declined from avg 71 to avg 48 (-23 points) over the 14-day period" |
| 3 | Severe sleep deficit | HIGH | Avg hours_slept < 5 over period | "Severe sleep deficit: averaged only 4.2 hours of sleep over the past 14 days" |
| 4 | Moderate sleep deficit | MEDIUM | Avg hours_slept between 5 and 6 | "Sleep deficit: averaged 5.4 hours of sleep over the past 14 days (recommended: 7-9 hours)" |
| 5 | High stress | MEDIUM | Avg stress_level > 7 (out of 10) | "Elevated stress levels: averaged 8.1/10 stress over the past 14 days" |
| 6 | Persistent pain | MEDIUM | Pain (pain_level > 0) reported on 3+ consecutive days | "Persistent pain: Lower Back pain reported for 5 consecutive days (Feb 9-13)" |
| 7 | Sudden readiness drop | MEDIUM | Any day-over-day readiness drop > 20 points | "Sudden readiness drop of 28 points on Feb 12 (from 75 to 47)" |
| 8 | Low attendance | MEDIUM | Less than 50% check-in completion (totalCheckIns / periodDays) | "Low check-in attendance: only 5 out of 14 days had check-ins (36%)" |
| 9 | Low physical condition | LOW | Avg physical_score < 50 | "Below-average physical condition: averaged 42/100 physical score" |

### Trend Calculation

1. Split check-ins chronologically into first half and second half
2. Calculate average readiness_score for each half
3. Determine trend:
   - **DECLINING**: second half avg is 10+ points lower than first half
   - **IMPROVING**: second half avg is 10+ points higher than first half
   - **STABLE**: difference is less than 10 points in either direction

### Lowest Category Detection

1. Calculate averages for: sleep_score, stress_score, physical_score
2. If pain_score exists on any check-in, also average pain_score (only across days with pain reported)
3. Return the category with the lowest average score

### Output Structure

```typescript
interface RiskAnalysis {
  summary: {
    avgReadiness: number;          // Overall avg readiness score
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    redDays: number;               // Count of RED readiness days
    yellowDays: number;            // Count of YELLOW readiness days
    greenDays: number;             // Count of GREEN readiness days
    totalCheckIns: number;         // How many check-ins exist in period
    periodDays: number;            // Always 14
  };
  riskFactors: Array<{
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    category: 'sleep' | 'stress' | 'physical' | 'pain' | 'overall' | 'attendance';
    title: string;                 // Short label (e.g., "Consecutive RED days")
    description: string;           // Full explanation with data
  }>;
  lowestCategory: {
    category: string;              // 'sleep' | 'stress' | 'physical' | 'pain'
    avgScore: number;              // The avg score for that category
  };
  checkIns: Array<{
    date: string;                  // ISO date string
    readinessScore: number;
    readinessLevel: string;        // GREEN | YELLOW | RED
    sleepScore: number;
    stressScore: number;
    physicalScore: number;
    painScore: number | null;
    hoursSlept: number;
    stressLevel: number;
    painLevel: number | null;
    painLocation: string | null;
  }>;
}
```

---

## UI Mockup

The Risk Analysis section appears on the Case Detail page, below the existing 2x2 info grid, above the timeline section.

```
┌─ Risk Analysis ──────────────────────────────────────────────┐
│                                                              │
│  Summary                                                     │
│  ┌────────────┬───────────────┬──────────────────────────┐   │
│  │ Avg: 52/100│ Trend: DECL.  │ 4 RED  3 YELLOW  2 GREEN│   │
│  │            │      ↘        │ (9 check-ins / 14 days)  │   │
│  └────────────┴───────────────┴──────────────────────────┘   │
│  Lowest Category: Sleep (avg 42/100)                         │
│                                                              │
│  Risk Factors                                                │
│  ┌─ HIGH ──────────────────────────────────────────────────┐ │
│  │ Consecutive RED days                                    │ │
│  │ Worker had 4 consecutive RED readiness days (Feb 10-13) │ │
│  │ immediately before the incident.                        │ │
│  ├─ HIGH ──────────────────────────────────────────────────┤ │
│  │ Declining trend                                         │ │
│  │ Readiness declined from avg 71 to avg 48 (-23 points)   │ │
│  │ over the 14-day period.                                 │ │
│  ├─ MEDIUM ────────────────────────────────────────────────┤ │
│  │ Persistent pain                                         │ │
│  │ Lower Back pain reported for 5 consecutive days         │ │
│  │ (Feb 9-13).                                             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Check-In History (14 days before incident)                  │
│  ┌────────┬───────┬────────┬──────────┬──────┬─────────────┐ │
│  │ Date   │ Sleep │ Stress │ Physical │ Pain │ Readiness   │ │
│  ├────────┼───────┼────────┼──────────┼──────┼─────────────┤ │
│  │ Feb 14 │  45   │   30   │    60    │  80  │  48  RED    │ │
│  │ Feb 13 │  55   │   40   │    70    │  70  │  57  YELLOW │ │
│  │ Feb 12 │  47   │   35   │    50    │  60  │  46  RED    │ │
│  │ Feb 11 │  42   │   30   │    55    │  70  │  45  RED    │ │
│  │ Feb 10 │  48   │   40   │    60    │  80  │  49  RED    │ │
│  │ Feb 9  │  60   │   50   │    70    │  60  │  59  YELLOW │ │
│  │ Feb 8  │  65   │   55   │    75    │  70  │  65  YELLOW │ │
│  │ Feb 7  │  70   │   60   │    80    │  -   │  70  GREEN  │ │
│  │ Feb 6  │  75   │   65   │    80    │  -   │  73  GREEN  │ │
│  │  ...   │       │        │          │      │             │ │
│  └────────┴───────┴────────┴──────────┴──────┴─────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## API Endpoint

### `GET /api/v1/cases/:id/risk-analysis`

**Access Control:** Same as `GET /cases/:id`
- WHS / ADMIN: can view any case
- WORKER: can view only if they are the incident reporter

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": { ... },
    "riskFactors": [ ... ],
    "lowestCategory": { ... },
    "checkIns": [ ... ]
  }
}
```

**Error Cases:**
- 404: Case not found
- 403: Not authorized to view this case
- 200 with empty checkIns: Worker has no check-in data in the period (riskFactors will be empty, summary will show zeros)

---

## Files to Create/Modify

### Backend (aegira-backend/src/)

| File | Action | Description |
|------|--------|-------------|
| `modules/check-in/check-in.repository.ts` | Modify | Add `findByPersonAndDateRange()` method |
| `modules/case/risk-analysis.util.ts` | **New** | Risk analysis algorithm (pure function) |
| `modules/case/case.routes.ts` | Modify | Add `GET /:id/risk-analysis` route |
| `modules/case/case.controller.ts` | Modify | Add `getRiskAnalysis()` handler |

### Frontend (aegira-frontend/src/)

| File | Action | Description |
|------|--------|-------------|
| `lib/api/endpoints.ts` | Modify | Add `CASE.RISK_ANALYSIS` endpoint |
| `types/incident.types.ts` | Modify | Add risk analysis interfaces |
| `features/incident/hooks/useCaseRiskAnalysis.ts` | **New** | TanStack Query hook |
| `features/incident/components/RiskAnalysisPanel.tsx` | **New** | UI component |
| `features/incident/pages/CaseDetailPage.tsx` | Modify | Add RiskAnalysisPanel |

---

## Business Value

- **Investigation speed**: WHS officers get immediate context instead of manually reviewing check-in records
- **Pattern identification**: Algorithm surfaces patterns that humans might miss (gradual declines over 2 weeks)
- **Documentation**: Risk analysis becomes part of the case record for compliance/legal purposes
- **Prevention insight**: Over time, risk patterns across cases reveal systemic issues (e.g., all physical injuries preceded by sleep deficits)
- **Zero ongoing cost**: Rule-based algorithm, no external API calls

## Future Enhancements (Not in Scope)

- Proactive risk alerts (Phase C): Flag at-risk workers before incidents happen
- Cross-case pattern analysis: Identify common risk patterns across all cases
- PDF export of risk analysis for compliance reporting
- Configurable detection thresholds per company
