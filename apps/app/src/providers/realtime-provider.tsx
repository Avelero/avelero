"use client";

import {
  REALTIME_DOMAINS,
  REALTIME_DOMAIN_NAMES,
  type RealtimeDomain,
} from "@/config/realtime-config";
import { useThrottledCallback } from "@/hooks/use-throttled-callback";
import { useUserQuerySuspense } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { toast } from "@v1/ui/sonner";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface RealtimeContextValue {
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
});

function useRealtime() {
  return useContext(RealtimeContext);
}

// Reconnection configuration
const RECONNECT_CONFIG = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxRetries: 10,
  backoffMultiplier: 2,
} as const;

// Calculate delay with exponential backoff
function getBackoffDelay(attempt: number): number {
  const delay =
    RECONNECT_CONFIG.initialDelayMs *
    RECONNECT_CONFIG.backoffMultiplier ** attempt;
  return Math.min(delay, RECONNECT_CONFIG.maxDelayMs);
}

// Development-only logging (silent in production)
function logRealtimeError(message: string, error?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[Realtime] ${message}`, error ?? "");
  }
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { data: user } = useUserQuerySuspense();
  const brandId = user?.brand_id;
  const userId = user?.id;

  // Use state for isConnected so UI can react to changes
  const [isConnected, setIsConnected] = useState(false);

  // Track retry state per channel
  const retryStateRef = useRef<
    Map<
      string,
      { attempts: number; timeoutId: ReturnType<typeof setTimeout> | null }
    >
  >(new Map());

  // Create base invalidator for a domain using predicate-based matching
  // TRPC query keys: [["router", "procedure"], { input, type }]
  // We match based on the first segment (router name) of key[0]
  const createInvalidator = useCallback(
    (domain: RealtimeDomain) => () => {
      const config = REALTIME_DOMAINS[domain];
      const routers = config.routers as readonly string[];
      const exactPaths = (
        "exactPaths" in config ? config.exactPaths : []
      ) as readonly (readonly string[])[];

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;

          // TRPC query keys: [["router", "procedure", ...], { input, type }]
          if (!Array.isArray(key) || key.length < 1 || !Array.isArray(key[0])) {
            return false;
          }

          const pathSegments = key[0] as string[];
          if (pathSegments.length < 1) return false;

          const routerName = pathSegments[0] as string;

          // Check if router name matches
          if (
            routerName &&
            (routers as readonly string[]).some((r) => r === routerName)
          ) {
            return true;
          }

          // Check exact path matches (e.g., ["brand", "members"])
          for (const exactPath of exactPaths) {
            if (
              pathSegments.length >= exactPath.length &&
              exactPath.every((seg, i) => pathSegments[i] === seg)
            ) {
              return true;
            }
          }

          return false;
        },
      });
    },
    [queryClient],
  );

  // Create throttled invalidators for domains that need it
  const throttledProductsInvalidate = useThrottledCallback(
    createInvalidator("products"),
    REALTIME_DOMAINS.products.throttleMs,
    { leading: true, trailing: true },
  );

  const throttledIntegrationsInvalidate = useThrottledCallback(
    createInvalidator("integrations"),
    REALTIME_DOMAINS.integrations.throttleMs,
    { leading: true, trailing: true },
  );

  // Non-throttled invalidators (memoized to ensure stable references)
  const catalogInvalidate = useMemo(
    () => createInvalidator("catalog"),
    [createInvalidator],
  );
  const teamInvalidate = useMemo(
    () => createInvalidator("team"),
    [createInvalidator],
  );
  const jobsInvalidate = useMemo(
    () => createInvalidator("jobs"),
    [createInvalidator],
  );
  const themeInvalidate = useMemo(
    () => createInvalidator("theme"),
    [createInvalidator],
  );

  // Map domain to its invalidator
  const getInvalidator = useCallback(
    (domain: RealtimeDomain) => {
      switch (domain) {
        case "products":
          return throttledProductsInvalidate;
        case "integrations":
          return throttledIntegrationsInvalidate;
        case "catalog":
          return catalogInvalidate;
        case "team":
          return teamInvalidate;
        case "jobs":
          return jobsInvalidate;
        case "theme":
          return themeInvalidate;
      }
    },
    [
      throttledProductsInvalidate,
      throttledIntegrationsInvalidate,
      catalogInvalidate,
      teamInvalidate,
      jobsInvalidate,
      themeInvalidate,
    ],
  );

  useEffect(() => {
    if (!brandId) return;

    let isCancelled = false;
    const channels: Map<
      string,
      ReturnType<typeof supabase.channel>
    > = new Map();

    // Subscribe to a single channel with retry logic
    const subscribeToChannel = (domain: RealtimeDomain, topicName: string) => {
      if (isCancelled) return;

      // Remove existing channel if present (for reconnection)
      const existingChannel = channels.get(topicName);
      if (existingChannel) {
        supabase.removeChannel(existingChannel);
        channels.delete(topicName);
      }

      const channel = supabase
        .channel(topicName, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, () => {
          getInvalidator(domain)();
        })
        .on("broadcast", { event: "UPDATE" }, () => {
          getInvalidator(domain)();
        })
        .on("broadcast", { event: "DELETE" }, () => {
          getInvalidator(domain)();
        })
        // Bulk operation events (consolidated broadcast per batch)
        .on("broadcast", { event: "BULK_INSERT" }, () => {
          getInvalidator(domain)();
        })
        .on("broadcast", { event: "BULK_UPDATE" }, () => {
          getInvalidator(domain)();
        })
        .on("broadcast", { event: "BULK_DELETE" }, () => {
          getInvalidator(domain)();
        })
        .on("broadcast", { event: "BULK_SYNC" }, () => {
          getInvalidator(domain)();
        })
        .subscribe((status, err) => {
          if (isCancelled) return;

          if (status === "SUBSCRIBED") {
            // Successfully connected - reset retry state and update connection status
            const retryState = retryStateRef.current.get(topicName);
            if (retryState?.timeoutId) {
              clearTimeout(retryState.timeoutId);
            }
            retryStateRef.current.set(topicName, {
              attempts: 0,
              timeoutId: null,
            });
            setIsConnected(true);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // Channel failed - attempt reconnection with backoff
            logRealtimeError(
              `Channel ${status.toLowerCase().replace("_", " ")} on ${topicName}`,
              err,
            );

            setIsConnected(false);
            scheduleReconnect(domain, topicName);
          } else if (status === "CLOSED") {
            // Channel was closed - could be intentional or due to disconnect
            setIsConnected(false);
          }
        });

      channels.set(topicName, channel);
    };

    // Schedule a reconnection attempt with exponential backoff
    const scheduleReconnect = (domain: RealtimeDomain, topicName: string) => {
      if (isCancelled) return;

      const currentState = retryStateRef.current.get(topicName) ?? {
        attempts: 0,
        timeoutId: null,
      };

      // Clear any existing timeout
      if (currentState.timeoutId) {
        clearTimeout(currentState.timeoutId);
      }

      // Check if we've exceeded max retries
      if (currentState.attempts >= RECONNECT_CONFIG.maxRetries) {
        logRealtimeError(
          `Max reconnection attempts (${RECONNECT_CONFIG.maxRetries}) reached for ${topicName}. Real-time updates may be unavailable until page refresh.`,
        );
        return;
      }

      const delay = getBackoffDelay(currentState.attempts);

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[Realtime] Reconnecting ${topicName} in ${delay}ms (attempt ${currentState.attempts + 1}/${RECONNECT_CONFIG.maxRetries})`,
        );
      }

      const timeoutId = setTimeout(() => {
        if (!isCancelled) {
          subscribeToChannel(domain, topicName);
        }
      }, delay);

      retryStateRef.current.set(topicName, {
        attempts: currentState.attempts + 1,
        timeoutId,
      });
    };

    // Set auth FIRST, then subscribe to channels
    const setupChannels = async () => {
      try {
        await supabase.realtime.setAuth();
      } catch (err) {
        logRealtimeError("Auth set failed", err);
        return;
      }

      if (isCancelled) return;

      // Subscribe to each domain's broadcast topic
      for (const domain of REALTIME_DOMAIN_NAMES) {
        const topicName = `${domain}:${brandId}`;
        subscribeToChannel(domain, topicName);
      }
    };

    // Invoke setup
    setupChannels();

    // Cleanup
    return () => {
      isCancelled = true;

      // Clear all pending reconnection timeouts
      for (const [, state] of retryStateRef.current) {
        if (state.timeoutId) {
          clearTimeout(state.timeoutId);
        }
      }
      retryStateRef.current.clear();

      // Remove all channels
      for (const [, channel] of channels) {
        supabase.removeChannel(channel);
      }
      channels.clear();

      setIsConnected(false);
    };
  }, [brandId, supabase, getInvalidator]);

  // =============================================
  // USER NOTIFICATIONS CHANNEL
  // =============================================
  // Separate subscription for user-scoped notifications (not brand-scoped).
  // Shows toasts when import success/failure notifications arrive.
  useEffect(() => {
    if (!userId) return;

    const topicName = `notifications:${userId}`;

    const channel = supabase
      .channel(topicName, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, (payload) => {
        // Show toast for import notifications
        // Payload structure from realtime.send(): { id, type, title, message }
        const data = payload.payload as
          | { type?: string; title?: string }
          | undefined;

        if (data?.type === "import_success" && data.title) {
          toast.success(data.title);
        } else if (data?.type === "import_failure" && data.title) {
          toast.error(data.title);
        }

        // Invalidate notification queries to update UI (badge count, list)
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.getUnreadCount.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.getRecent.queryKey(),
        });
      })
      .on("broadcast", { event: "UPDATE" }, () => {
        // Notification was marked as seen/dismissed - update queries
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.getUnreadCount.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.getRecent.queryKey(),
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, queryClient, trpc]);

  return (
    <RealtimeContext.Provider value={{ isConnected }}>
      {children}
    </RealtimeContext.Provider>
  );
}
