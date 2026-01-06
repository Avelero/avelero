ALTER TABLE "users" DROP CONSTRAINT "users_avatar_hue_check";--> statement-breakpoint
ALTER TABLE "brands" DROP CONSTRAINT "brands_avatar_hue_check";--> statement-breakpoint
DROP INDEX "idx_brands_avatar_hue";--> statement-breakpoint
ALTER TABLE "promotion_operations" ALTER COLUMN "started_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "avatar_hue";--> statement-breakpoint
ALTER TABLE "brands" DROP COLUMN "avatar_hue";