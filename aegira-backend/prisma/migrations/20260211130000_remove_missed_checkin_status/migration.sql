-- Remove status workflow from missed check-ins
-- Missed check-ins are now simple records with no status management

-- Drop status-related indexes first
DROP INDEX IF EXISTS "missed_check_ins_company_id_status_idx";
DROP INDEX IF EXISTS "missed_check_ins_company_id_status_missed_date_idx";
DROP INDEX IF EXISTS "missed_check_ins_company_id_team_id_status_idx";
DROP INDEX IF EXISTS "missed_check_ins_resolved_by_idx";

-- Remove status workflow columns
ALTER TABLE "missed_check_ins" DROP COLUMN IF EXISTS "status";
ALTER TABLE "missed_check_ins" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "missed_check_ins" DROP COLUMN IF EXISTS "resolved_by";
ALTER TABLE "missed_check_ins" DROP COLUMN IF EXISTS "resolved_at";

-- Drop the enum type
DROP TYPE IF EXISTS "MissedCheckInStatus";
