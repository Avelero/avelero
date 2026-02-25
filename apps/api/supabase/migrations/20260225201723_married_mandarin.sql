ALTER TABLE "product_passports" DROP CONSTRAINT "product_passports_brand_id_brands_id_fk";
--> statement-breakpoint
ALTER TABLE "product_passports" ALTER COLUMN "brand_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_passports" ADD CONSTRAINT "product_passports_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE cascade;