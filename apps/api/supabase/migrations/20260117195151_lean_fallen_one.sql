ALTER TABLE "product_passports" DROP COLUMN "last_published_at";--> statement-breakpoint
ALTER POLICY "product_passports_select_public" ON "product_passports" TO anon USING (
        current_version_id IS NOT NULL
        AND (
          working_variant_id IS NULL
          OR
          EXISTS (
            SELECT 1 FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = working_variant_id
            AND p.status = 'published'
          )
        )
      );