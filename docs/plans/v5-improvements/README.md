# AEGIRA V5 System Improvement Plan

## Context

Based on the [Technical Build Playbook gap analysis](../../features/whs-dashboard/AEGIRA_V5_vs_Playbook_Complete_Analysis.md), AEGIRA V5 has **7 critical gaps** and **5 major issues**. The current system records check-ins and scores but lacks event-time tracking, personal baselines, deviation-based risk detection, and proper late/missed handling.

This plan transforms AEGIRA into a **longitudinal risk detection system** in 6 incremental phases, each independently deployable without breaking existing functionality.

## Gap Summary

| # | Gap | Severity | Phase |
|---|-----|----------|-------|
| 1 | Event-Time vs Database-Time | Critical | Phase 1 |
| 2 | No Event Sourcing (append-only) | Critical | Deferred |
| 3 | No Shift/Prompt Context | Critical | Deferred |
| 4 | Missed Check-ins: Implied vs Explicit | Critical | Phase 2 |
| 5 | Late Submission Handling | Critical | Phase 1 + 2 |
| 6 | No Baseline/Longitudinal Features | Critical | Phase 4 |
| 7 | Risk Detection: Absolute Thresholds | Critical | Phase 4 |
| M1 | No Risk Episodes/Signal Clustering | Major | Phase 5 |
| M2 | No Availability/Off-Shift Tracking | Major | Phase 3 |
| M3 | No Feature Versioning/Explainability | Major | Phase 6 |

## Phase Order & Dependencies

```
Phase 1 (Event Model + Late Tracking) <- Foundation, do first
  |
Phase 2 (Explicit Missed Resolution) <- Depends on Phase 1 event types
  |
Phase 3 (Availability Tracking) <- Independent, enhances Phase 2
  |
Phase 4 (Personal Baselines) <- Core analytics, needs check-in history
  |
Phase 5 (Risk Episodes) <- Depends on Phase 4 deviations
  |
Phase 6 (Decision Logs) <- Depends on Phase 4 + 5
```

## Phase Files

| File | Description |
|------|-------------|
| [phase-1-event-model.md](./phase-1-event-model.md) | Event-time tracking + late submission detection |
| [phase-2-missed-resolution.md](./phase-2-missed-resolution.md) | Explicit missed events + late resolves missed |
| [phase-3-availability.md](./phase-3-availability.md) | Leave/sick/off-shift tracking |
| [phase-4-baselines.md](./phase-4-baselines.md) | Personal baselines + deviation detection |
| [phase-5-risk-episodes.md](./phase-5-risk-episodes.md) | Signal clustering + episode lifecycle |
| [phase-6-decision-log.md](./phase-6-decision-log.md) | Explainability + versioning |
| [deferred.md](./deferred.md) | What's NOT in scope and why |

## Verification (All Phases)

After each phase:
1. `npm run typecheck` in `aegira-backend/` -- must pass
2. `npm run db:migrate` -- migration must apply cleanly
3. `npm run build` in `aegira-frontend/` -- must compile
4. Manual test: existing check-in flow, missed detection, and dashboards still work
