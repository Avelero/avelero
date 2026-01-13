"use client";

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { useUserQuerySuspense } from "@/hooks/use-user";
import {
    REALTIME_DOMAINS,
    REALTIME_DOMAIN_NAMES,
    type RealtimeDomain,
} from "@/config/realtime-config";
import { useThrottledCallback } from "@/hooks/use-throttled-callback";

interface RealtimeContextValue {
    isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
    isConnected: false,
});

export function useRealtime() {
    return useContext(RealtimeContext);
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
    const supabase = useMemo(() => createClient(), []);
    const queryClient = useQueryClient();
    const { data: user } = useUserQuerySuspense();
    const brandId = user?.brand_id;
    const isConnectedRef = useRef(false);

    // Create base invalidator for a domain using predicate-based matching
    // TRPC query keys: [["router", "procedure"], { input, type }]
    // We match based on the first segment (router name) of key[0]
    const createInvalidator = useCallback(
        (domain: RealtimeDomain) => () => {
            const config = REALTIME_DOMAINS[domain];
            const routers = config.routers as readonly string[];
            const exactPaths = ("exactPaths" in config ? config.exactPaths : []) as readonly (readonly string[])[];

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
                    if (routerName && (routers as readonly string[]).some(r => r === routerName)) {
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

    // Non-throttled invalidators (called directly)
    const catalogInvalidate = createInvalidator("catalog");
    const teamInvalidate = createInvalidator("team");
    const jobsInvalidate = createInvalidator("jobs");
    const themeInvalidate = createInvalidator("theme");

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
        const channels: ReturnType<typeof supabase.channel>[] = [];

        // Set auth FIRST, then subscribe to channels
        const setupChannels = async () => {
            try {
                await supabase.realtime.setAuth();
            } catch (err) {
                console.error("[Realtime] Auth set failed:", err);
                return;
            }

            if (isCancelled) return;

            // Subscribe to each domain's broadcast topic
            for (const domain of REALTIME_DOMAIN_NAMES) {
                const topicName = `${domain}:${brandId}`;

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
                        if (status === "SUBSCRIBED") {
                            isConnectedRef.current = true;
                        } else if (status === "CHANNEL_ERROR") {
                            console.error(`[Realtime] Channel error on ${topicName}:`, err);
                        } else if (status === "TIMED_OUT") {
                            console.error(`[Realtime] Channel timed out: ${topicName}`);
                        }
                    });

                channels.push(channel);
            }
        };

        // Invoke setup
        setupChannels();

        // Cleanup
        return () => {
            isCancelled = true;
            for (const channel of channels) {
                supabase.removeChannel(channel);
            }
            isConnectedRef.current = false;
        };
    }, [brandId, supabase, getInvalidator]);

    return (
        <RealtimeContext.Provider value={{ isConnected: isConnectedRef.current }}>
            {children}
        </RealtimeContext.Provider>
    );
}
