ALTER TABLE "brand_certifications" RENAME COLUMN "institute_contact" TO "institute_email";--> statement-breakpoint
ALTER TABLE "brand_certifications" RENAME COLUMN "external_url" TO "institute_website";--> statement-breakpoint
ALTER TABLE "brand_certifications" RENAME COLUMN "file_asset_id" TO "file_path";--> statement-breakpoint
ALTER TABLE "brand_certifications" DROP CONSTRAINT "brand_certifications_file_asset_id_file_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "brand_certifications" ADD COLUMN "institute_address_line_1" text;--> statement-breakpoint
ALTER TABLE "brand_certifications" ADD COLUMN "institute_address_line_2" text;--> statement-breakpoint
ALTER TABLE "brand_certifications" ADD COLUMN "institute_city" text;--> statement-breakpoint
ALTER TABLE "brand_certifications" ADD COLUMN "institute_state" text;--> statement-breakpoint
ALTER TABLE "brand_certifications" ADD COLUMN "institute_zip" text;--> statement-breakpoint
ALTER TABLE "brand_certifications" ADD COLUMN "institute_country_code" text;--> statement-breakpoint
ALTER TABLE "brand_certifications" DROP COLUMN "institute_address";--> statement-breakpoint
ALTER TABLE "brand_certifications" DROP COLUMN "notes";