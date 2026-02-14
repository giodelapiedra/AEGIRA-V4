-- Phase 1: Event Model Enhancement & Late Submission Tracking
-- Adds event-time tracking and late submission detection to Event model

-- Step 1: Add new columns (nullable initially for backfill)
ALTER TABLE "events" ADD COLUMN "event_time" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "ingested_at" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "event_timezone" TEXT;
ALTER TABLE "events" ADD COLUMN "is_late" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "late_by_minutes" INTEGER;

-- Step 2: Backfill existing records
-- event_time = created_at (best approximation for historical data)
-- ingested_at = created_at (same as above)
-- event_timezone = company's timezone setting
UPDATE "events" SET
  "event_time" = "created_at",
  "ingested_at" = "created_at",
  "event_timezone" = (
    SELECT "timezone" FROM "companies"
    WHERE "companies"."id" = "events"."company_id"
  )
WHERE "event_time" IS NULL;

-- Step 3: Make columns NOT NULL after backfill
ALTER TABLE "events" ALTER COLUMN "event_time" SET NOT NULL;
ALTER TABLE "events" ALTER COLUMN "ingested_at" SET NOT NULL;
ALTER TABLE "events" ALTER COLUMN "event_timezone" SET NOT NULL;

-- Step 4: Add new indexes for event-time queries
CREATE INDEX "events_company_id_event_time_idx" ON "events"("company_id", "event_time");
CREATE INDEX "events_company_id_person_id_event_time_idx" ON "events"("company_id", "person_id", "event_time");

-- Step 5: Add new EventType enum values
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'MISSED_CHECK_IN_DETECTED';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'MISSED_CHECK_IN_RESOLVED';
