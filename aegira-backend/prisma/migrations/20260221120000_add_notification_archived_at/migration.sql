-- Add archived_at for notification archive feature (soft-archive, not delete)
ALTER TABLE "notifications" ADD COLUMN "archived_at" TIMESTAMP(3);

-- Composite index: active vs archived notifications per person, sorted by created_at
CREATE INDEX "notifications_company_id_person_id_archived_at_created_at_idx"
  ON "notifications"("company_id", "person_id", "archived_at", "created_at" DESC);
