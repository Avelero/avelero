CREATE TABLE "brand_billing_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"stripe_customer_id" text,
	"status" text NOT NULL,
	"collection_method" text,
	"currency" text DEFAULT 'eur' NOT NULL,
	"amount_due" integer DEFAULT 0 NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"amount_remaining" integer DEFAULT 0 NOT NULL,
	"subtotal" integer,
	"total" integer,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"hosted_invoice_url" text,
	"invoice_pdf_url" text,
	"invoice_number" text,
	"service_period_start" timestamp with time zone,
	"service_period_end" timestamp with time zone,
	"recipient_name" text,
	"recipient_email" text,
	"recipient_tax_id" text,
	"recipient_address_line_1" text,
	"recipient_address_line_2" text,
	"recipient_address_city" text,
	"recipient_address_region" text,
	"recipient_address_postal_code" text,
	"recipient_address_country" text,
	"description" text,
	"footer" text,
	"internal_reference" text,
	"managed_by_avelero" boolean DEFAULT false NOT NULL,
	"last_synced_from_stripe_at" timestamp with time zone,
	"last_stripe_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_billing_invoices_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'paid'::text, 'uncollectible'::text, 'void'::text])),
	CONSTRAINT "brand_billing_invoices_collection_method_check" CHECK (collection_method IS NULL OR collection_method = ANY (ARRAY['charge_automatically'::text, 'send_invoice'::text])),
	CONSTRAINT "brand_billing_invoices_currency_check" CHECK (char_length(currency) = 3),
	CONSTRAINT "brand_billing_invoices_amount_due_check" CHECK (amount_due >= 0),
	CONSTRAINT "brand_billing_invoices_amount_paid_check" CHECK (amount_paid >= 0),
	CONSTRAINT "brand_billing_invoices_amount_remaining_check" CHECK (amount_remaining >= 0),
	CONSTRAINT "brand_billing_invoices_service_period_check" CHECK (service_period_end IS NULL OR service_period_start IS NULL OR service_period_end >= service_period_start)
);
--> statement-breakpoint
ALTER TABLE "brand_billing_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "current_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "past_due_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "pending_cancellation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_legal_name" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_tax_id" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_address_line_1" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_address_line_2" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_address_city" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_address_region" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_address_postal_code" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "billing_address_country" text;--> statement-breakpoint
ALTER TABLE "brand_billing_invoices" ADD CONSTRAINT "brand_billing_invoices_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_billing_invoices_stripe_invoice_id_unq" ON "brand_billing_invoices" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_brand_billing_invoices_brand_created_at" ON "brand_billing_invoices" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_brand_billing_invoices_brand_status" ON "brand_billing_invoices" USING btree ("brand_id","status");--> statement-breakpoint
CREATE INDEX "idx_brand_billing_invoices_due_date" ON "brand_billing_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_brand_billing_current_period_end" ON "brand_billing" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "idx_brand_billing_past_due_since" ON "brand_billing" USING btree ("past_due_since");--> statement-breakpoint
ALTER TABLE "brand_billing" ADD CONSTRAINT "brand_billing_period_window_check" CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end >= current_period_start);--> statement-breakpoint
CREATE POLICY "brand_billing_invoices_select_for_brand_members" ON "brand_billing_invoices" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_billing_invoices_insert_by_service_role" ON "brand_billing_invoices" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_billing_invoices_update_by_service_role" ON "brand_billing_invoices" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_billing_invoices_delete_by_service_role" ON "brand_billing_invoices" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);