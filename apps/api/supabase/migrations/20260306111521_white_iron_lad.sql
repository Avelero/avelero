ALTER TABLE "product_passport_versions" ALTER COLUMN "data_snapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_passport_versions" ADD COLUMN "compressed_snapshot" "bytea";--> statement-breakpoint
ALTER TABLE "product_passport_versions" ADD COLUMN "compressed_at" timestamp with time zone;