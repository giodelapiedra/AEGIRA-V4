# Phase 3a: Case Risk Analysis

**Date**: 2026-02-15
**Status**: Planned
**Gaps addressed**: Bridges #6 (No Baseline/Longitudinal Features) and #7 (Risk Detection: Absolute Thresholds)
**Risk**: Low -- uses existing check-in data, no schema changes
**Depends on**: Phase 1 (event model), Phase 2 (missed resolution) -- both completed

## Objective

Leverage daily check-in data to provide automatic risk analysis when investigating incident cases. Rule-based algorithm detects patterns (declining readiness, sleep deficit, persistent pain, etc.) and surfaces them on the Case Detail page.

## Why Phase 3a (Not Phase 4)

This is a **stepping stone** between Phase 3 (Availability Tracking) and Phase 4 (Personal Baselines):

- Phase 4 requires personal baseline calculations (30-day rolling averages, standard deviations)
- Phase 3a is simpler: analyze a **fixed 14-day window** relative to a specific incident
- Delivers immediate value without the complexity of baseline infrastructure
- Validates the concept before investing in full Phase 4

```
Phase 1 (Event Model)           <- COMPLETED
  |
Phase 2 (Missed Resolution)     <- COMPLETED
  |
Phase 3 (Availability Tracking) <- Planned
  |
Phase 3a (Case Risk Analysis)   <- THIS PHASE (independent of Phase 3)
  |
Phase 4 (Personal Baselines)    <- Will build on learnings from 3a
  |
Phase 5 (Risk Episodes)
  |
Phase 6 (Decision Logs)
```

## Scope

### In Scope
- New `GET /cases/:id/risk-analysis` endpoint
- Rule-based risk detection algorithm (9 detection rules)
- Risk Analysis panel on Case Detail page (frontend)
- Check-in history table for the 14-day pre-incident period

### Out of Scope
- Proactive risk alerts (before incidents happen) -- Phase C future
- Personal baselines / standard deviation detection -- Phase 4
- Schema/migration changes -- none needed
- Holiday/schedule-aware analysis -- simplified version first

## Technical Summary

### Backend
1. Add `findByPersonAndDateRange()` to check-in repository
2. Create `risk-analysis.util.ts` -- pure function, deterministic algorithm
3. Add route + controller for `GET /cases/:id/risk-analysis`

### Frontend
1. New `useCaseRiskAnalysis` query hook
2. New `RiskAnalysisPanel` component
3. Integrate into existing `CaseDetailPage`

### Detection Rules

| Rule | Severity | Trigger |
|------|----------|---------|
| Consecutive RED days | HIGH | 3+ consecutive days readiness < 50 |
| Declining trend | HIGH | 15+ point drop between first/second half |
| Severe sleep deficit | HIGH | Avg hours_slept < 5 |
| Moderate sleep deficit | MEDIUM | Avg hours_slept 5-6 |
| High stress | MEDIUM | Avg stress_level > 7/10 |
| Persistent pain | MEDIUM | Pain on 3+ consecutive days |
| Sudden drop | MEDIUM | Day-over-day drop > 20 points |
| Low attendance | MEDIUM | < 50% check-in completion |
| Low physical | LOW | Avg physical_score < 50 |

## Full Specification

See [Feature Spec: Case Risk Analysis](../../features/incident/CASE-RISK-ANALYSIS.md) for complete details including:
- Data flow diagrams
- Algorithm details and output interfaces
- UI mockup
- File change list
- API endpoint specification

## Verification

1. `npm run typecheck` in `aegira-backend/` -- must pass
2. `npm run build` in `aegira-frontend/` -- must compile
3. Manual test: Open a Case Detail page → Risk Analysis panel loads with check-in data and detected risk factors
4. Edge case: Case where reporter has no check-ins → shows "No check-in data available"
