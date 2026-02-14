-- Phase 2: Missed Check-In Resolution Tracking
-- Adds resolution fields to track when a late check-in resolves a missed record

-- Step 1: Add resolution columns
ALTER TABLE "missed_check_ins" ADD COLUMN "resolved_by_check_in_id" TEXT;
ALTER TABLE "missed_check_ins" ADD COLUMN "resolved_at" TIMESTAMP(3);

-- Step 2: Add unique constraint on resolved_by_check_in_id (one miss per check-in)
ALTER TABLE "missed_check_ins" ADD CONSTRAINT "missed_check_ins_resolved_by_check_in_id_key" UNIQUE ("resolved_by_check_in_id");

-- Step 3: Add foreign key to check_ins table
ALTER TABLE "missed_check_ins" ADD CONSTRAINT "missed_check_ins_resolved_by_check_in_id_fkey"
  FOREIGN KEY ("resolved_by_check_in_id") REFERENCES "check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Add indexes for resolution queries
CREATE INDEX "missed_check_ins_company_id_resolved_at_idx" ON "missed_check_ins"("company_id", "resolved_at");
CREATE INDEX "missed_check_ins_company_id_person_id_missed_date_resolved_idx" ON "missed_check_ins"("company_id", "person_id", "missed_date", "resolved_at");
