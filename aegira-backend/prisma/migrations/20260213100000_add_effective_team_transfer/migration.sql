-- Add effective next-day team transfer fields to Person
ALTER TABLE "persons" ADD COLUMN "effective_team_id" TEXT;
ALTER TABLE "persons" ADD COLUMN "effective_transfer_date" DATE;
ALTER TABLE "persons" ADD COLUMN "transfer_initiated_by" TEXT;

-- Foreign key for effective_team_id → Team.id (SET NULL on delete)
ALTER TABLE "persons" ADD CONSTRAINT "persons_effective_team_id_fkey"
  FOREIGN KEY ("effective_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for transfer processor query (find pending transfers by date)
CREATE INDEX "persons_effective_transfer_date_idx" ON "persons"("effective_transfer_date");

-- Add new EventType enum values
ALTER TYPE "EventType" ADD VALUE 'TEAM_TRANSFER_INITIATED';
ALTER TYPE "EventType" ADD VALUE 'TEAM_TRANSFER_COMPLETED';
