-- Add indexes for hot dashboard query patterns (performance review 2026-02-20)

-- Event: recent activity query filters by company_id + event_type, sorts by created_at DESC
CREATE INDEX "events_company_id_event_type_created_at_idx" ON "events"("company_id", "event_type", "created_at" DESC);

-- Case: WHS dashboard "my cases" filters by company_id + assigned_to + status
CREATE INDEX "cases_company_id_assigned_to_status_idx" ON "cases"("company_id", "assigned_to", "status");

-- Case: WHS dashboard "resolved this month" filters by company_id + resolved_at date range
CREATE INDEX "cases_company_id_resolved_at_idx" ON "cases"("company_id", "resolved_at");
