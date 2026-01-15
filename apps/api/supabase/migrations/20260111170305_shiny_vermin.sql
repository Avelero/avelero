ALTER TABLE "import_jobs" ADD COLUMN "correction_file_path" text;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "correction_download_url" text;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "correction_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "user_email" text;