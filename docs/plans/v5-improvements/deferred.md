# Deferred Items

Items from the Technical Build Playbook that are intentionally **NOT** in the current improvement plan, with rationale.

## 1. Shift/Prompt Tables (Playbook Gap #3)

**What the playbook says**: Create separate `shifts` and `prompts` tables. Every check-in links to a specific prompt with `window_opens_at`/`window_closes_at`.

**Why deferred**: AEGIRA already has schedule logic built into `Team` (check_in_start, check_in_end, work_days) and `Person` (schedule overrides). The `getEffectiveSchedule()` utility in `src/shared/schedule.utils.ts` resolves worker-level overrides against team defaults. Adding separate shift/prompt tables would duplicate this logic without clear benefit for the current single-shift-per-team model.

**When to revisit**: If AEGIRA needs to support:
- Multiple shifts per team (morning/afternoon/night)
- Dynamic shift assignments (different shifts on different days)
- Integration with external roster systems

## 2. Full Event Sourcing with Projections (Playbook Gap #2)

**What the playbook says**: Make the events table the single source of truth. CheckIn becomes a "projection" rebuilt from events. Never UPDATE or DELETE events.

**Why deferred**: This is the highest-risk architectural change. Currently, CheckIn records are mutable (can be updated via amendments). Converting to immutable projections requires:
- Refactoring all check-in queries to use projection tables
- Building a reliable projection rebuild mechanism
- Handling eventual consistency between events and projections
- Performance testing with large event volumes

The current approach (events alongside mutable records) provides 90% of the audit trail benefit with much less complexity.

**When to revisit**: When AEGIRA needs:
- Time-travel queries ("what was this worker's state on Feb 1?")
- Multi-system integration where events are the contract
- Regulatory compliance requiring immutable records

## 3. Multi-Timezone per Worker

**What the playbook says**: Each worker/site can have a different timezone. Events store timezone, windows computed in local time.

**Why deferred**: AEGIRA currently uses company-level timezone (`Company.timezone`). All schedule windows and time comparisons use this single timezone. Supporting per-worker timezones would require:
- Adding `timezone` to Person model
- Refactoring `getEffectiveSchedule()` to resolve timezone
- Updating missed check-in detector to process workers by timezone groups
- Frontend changes to display times in worker's timezone

**When to revisit**: If AEGIRA supports companies with workers across multiple time zones (e.g., remote teams spanning Australia).

## 4. Generic Feature Store

**What the playbook says**: Create a key-value `feature_store` table for arbitrary computed features (fatigue_z_robust, trend_slope_7d, volatility_14d, etc.)

**Why deferred**: Our `PersonBaseline` + `CheckInDeviation` tables are purpose-built with typed columns. This is more queryable and type-safe than a generic key-value store. A generic feature store would be needed if we add many more computed features (e.g., trend slopes, volatility metrics, missingness rates).

**When to revisit**: When the number of computed features exceeds what can be reasonably modeled in typed tables (roughly 15+ distinct feature types).

## 5. Stream Processor / Async Event Pipeline

**What the playbook says**: Process events asynchronously via a stream processor (Kafka, Redis Streams, etc.) for decoupling and scalability.

**Why deferred**: AEGIRA uses fire-and-forget patterns for non-critical operations (audit logs, notifications, deviation detection). This is sufficient for the current scale. A full stream processor would be overkill for a single-server deployment.

**When to revisit**: When AEGIRA needs:
- Multi-instance deployment with shared event processing
- Event-driven integrations with external systems
- Processing latency requirements that can't be met with fire-and-forget

## 6. Schema Versioning for Forms

**What the playbook says**: Version the check-in form schema so changes to questions don't break historical data.

**Why deferred**: The current check-in form is stable (sleep, stress, physical condition, pain). The `version` field on `PersonBaseline` provides algorithm versioning. Form schema versioning would be needed if the check-in questions change frequently.

**When to revisit**: If AEGIRA adds configurable check-in forms per company or dynamically adds/removes questions.

## 7. Fatigue Field

**Note**: The playbook references `fatigue_level` extensively as a check-in input. The current AEGIRA CheckIn model does NOT have a `fatigue_level` field. The closest proxies are:
- `hours_slept` + `sleep_quality` (sleep-related fatigue)
- `stress_level` (mental fatigue)
- `physical_condition` (physical fatigue)

The baseline/deviation system in Phase 4 computes z-scores for all existing fields. If a dedicated `fatigue_level` input is needed, it should be added to the CheckIn model first, then incorporated into baselines.
