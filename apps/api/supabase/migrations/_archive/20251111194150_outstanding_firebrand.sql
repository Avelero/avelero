ALTER TABLE "product_variants" ALTER COLUMN "sku" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "upid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "additional_image_urls" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tags" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "ean" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "status" text;