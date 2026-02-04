-- Enable pg_trgm extension for better text search performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN indexes for text search on Person table
CREATE INDEX IF NOT EXISTS idx_persons_first_name_trgm ON persons USING GIN (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_persons_last_name_trgm ON persons USING GIN (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_persons_email_trgm ON persons USING GIN (email gin_trgm_ops);

-- Add GIN index for text search on Team table
CREATE INDEX IF NOT EXISTS idx_teams_name_trgm ON teams USING GIN (name gin_trgm_ops);
