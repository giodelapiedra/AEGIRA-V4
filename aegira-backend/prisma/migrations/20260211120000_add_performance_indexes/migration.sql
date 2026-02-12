-- CreateIndex
CREATE INDEX IF NOT EXISTS "check_ins_company_id_readiness_level_check_in_date_idx" ON "check_ins"("company_id", "readiness_level", "check_in_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "events_company_id_person_id_created_at_idx" ON "events"("company_id", "person_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "holidays_company_id_is_recurring_idx" ON "holidays"("company_id", "is_recurring");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "holidays_company_id_date_idx" ON "holidays"("company_id", "date");
