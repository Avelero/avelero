ALTER TABLE "passports" ADD COLUMN "variant_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "passports" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "passports_brand_product_variant_unq" ON "passports" USING btree ("brand_id","product_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passports_slug_unq" ON "passports" USING btree ("slug");