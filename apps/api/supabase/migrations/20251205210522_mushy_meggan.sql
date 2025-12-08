ALTER TABLE "products" ADD COLUMN "webshop_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sales_status" text;