import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import "./configure-trigger";
import { logger, schedules } from "@trigger.dev/sdk";
import type { Database } from "@v1/supabase/types";

export const cleanupExpiredInvites = schedules.task({
  id: "cleanup-expired-invites",
  // Nightly at 02:00 UTC
  cron: "0 2 * * *",
  run: async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY as string | undefined;
    if (!url || !serviceKey) {
      logger.error("Supabase env vars missing for cleanup", {
        hasUrl: !!url,
        hasKey: !!serviceKey,
      });
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createSupabaseClient<Database>(url, serviceKey);
    const nowIso = new Date().toISOString();

    // Delete invites that have an expires_at in the past
    const { error } = await supabase
      .from("brand_invites")
      .delete()
      .lte("expires_at", nowIso)
      .not("expires_at", "is", null);

    if (error) {
      logger.error("Failed to delete expired invites", {
        error: error.message,
      });
      throw error;
    }

    logger.log("Expired invites cleanup completed", { at: nowIso });
  },
});
