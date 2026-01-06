ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "season" text;--> statement-breakpoint
ALTER TABLE "staging_products" ADD COLUMN IF NOT EXISTS "season" text;