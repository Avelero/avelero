/**
 * Progress Broadcast Utility
 *
 * Broadcasts job progress updates via Supabase Realtime.
 * Used by background jobs to push real-time progress to connected clients.
 */

import { createClient } from "@supabase/supabase-js";

export type JobProgressType = "sync" | "promotion" | "import" | "export";
export type JobProgressStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobProgressPayload {
  jobId: string;
  jobType: JobProgressType;
  status: JobProgressStatus;
  processed: number;
  total: number | null;
  startedAt: string | null;
  errorMessage?: string | null;
  context?: Record<string, unknown>;
}

// Persistent channel cache (one per brand)
const channelCache = new Map<
  string,
  {
    channel: ReturnType<ReturnType<typeof createClient>["channel"]>;
    ready: boolean;
  }
>();

async function getOrCreateChannel(brandId: string) {
  const cached = channelCache.get(brandId);
  if (cached?.ready) return cached.channel;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[broadcast] Creating Supabase client for channel:', {
    url: supabaseUrl,
    hasServiceKey: !!serviceKey,
    brandId,
  });

  if (!supabaseUrl || !serviceKey) {
    console.error('[broadcast] Missing Supabase credentials:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!serviceKey,
    });
    throw new Error('Missing Supabase credentials for broadcast');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const channel = supabase.channel(`job-progress:${brandId}`);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        console.error('[broadcast] Channel subscription timeout after 5s');
        reject(new Error("Channel subscription timeout"));
      },
      5000,
    );
    channel.subscribe((status) => {
      console.log('[broadcast] Channel subscription status:', status);
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        channelCache.set(brandId, { channel, ready: true });
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        console.error('[broadcast] Channel subscription failed:', status);
        reject(new Error(`Channel subscription failed: ${status}`));
      }
    });
  });

  return channel;
}

export async function broadcastJobProgress(
  brandId: string,
  payload: JobProgressPayload,
): Promise<void> {
  try {
    const channel = await getOrCreateChannel(brandId);
    await channel.send({ type: "broadcast", event: "progress", payload });
  } catch {
    // Silently fail - progress is non-critical
  }
}

export function createThrottledBroadcaster(
  brandId: string,
  intervalMs = 2000,
): (payload: JobProgressPayload) => void {
  let lastBroadcast = 0;
  let pendingPayload: JobProgressPayload | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (pendingPayload) {
      await broadcastJobProgress(brandId, pendingPayload);
      pendingPayload = null;
    }
    timeoutId = null;
  };

  return (payload: JobProgressPayload) => {
    const now = Date.now();
    const elapsed = now - lastBroadcast;

    // Always broadcast immediately for terminal states
    if (
      payload.status === "completed" ||
      payload.status === "failed" ||
      payload.status === "cancelled"
    ) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastBroadcast = now;
      broadcastJobProgress(brandId, payload);
      return;
    }

    if (elapsed >= intervalMs) {
      lastBroadcast = now;
      broadcastJobProgress(brandId, payload);
    } else {
      pendingPayload = payload;
      if (!timeoutId) {
        timeoutId = setTimeout(flush, intervalMs - elapsed);
      }
    }
  };
}
