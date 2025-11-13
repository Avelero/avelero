-- Add new timestamp field for Phase 2 commit tracking
ALTER TABLE "import_jobs"
ADD COLUMN IF NOT EXISTS "commit_started_at" timestamp with time zone;--> statement-breakpoint

-- Add boolean flag for value approval requirement tracking
ALTER TABLE "import_jobs"
ADD COLUMN IF NOT EXISTS "requires_value_approval" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- Update status field comment to document all possible values
-- Status workflow: PENDING → VALIDATING → VALIDATED → (user approves) → COMMITTING → COMPLETED
--                                       ↓
--                                    FAILED
--                                       ↓
--                              (user can cancel)
--                                       ↓
--                                   CANCELLED
COMMENT ON COLUMN "import_jobs"."status" IS 'Import job status: PENDING | VALIDATING | VALIDATED | COMMITTING | COMPLETED | FAILED | CANCELLED';--> statement-breakpoint

-- Note: We don't use ENUM type for status to allow easier additions in the future
-- Status values are validated at application level (Drizzle schema + Zod schemas)
-- Current valid values:
--   PENDING - Job created, not yet processing
--   VALIDATING - Phase 1: Validating and populating staging tables
--   VALIDATED - Phase 1 complete: Ready for user review and approval
--   COMMITTING - Phase 2: Migrating staging data to production
--   COMPLETED - Both phases complete: Data in production
--   FAILED - Job failed during validation or commit
--   CANCELLED - User cancelled after validation before commit
