ALTER TABLE "brand_theme" ADD COLUMN "passport" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_theme" DROP COLUMN "theme_styles";--> statement-breakpoint
ALTER TABLE "brand_theme" DROP COLUMN "theme_config";