/**
 * Realtime subscription configuration.
 * Maps domains → TRPC router names to invalidate.
 *
 * When a realtime event is received for a domain, all queries matching
 * any of the router names will be invalidated.
 *
 * Note: Database-level throttling in realtime.broadcast_domain_changes() ensures
 * only one broadcast per domain/brand per second, so client-side throttle is not needed.
 */
export const REALTIME_DOMAINS = {
    products: {
        // Invalidate all products.* and summary.* queries
        routers: ["products", "summary"],
        throttleMs: 0, // No client throttle - database handles throttling
    },
    catalog: {
        // Invalidate catalog.* queries (composite.catalogContent handled separately)
        routers: ["catalog"],
        // Also match specific composite queries
        exactPaths: [["composite", "catalogContent"]],
        throttleMs: 0, // No throttle - infrequent updates
    },
    integrations: {
        // Invalidate all integrations.* queries
        routers: ["integrations"],
        throttleMs: 0, // No client throttle - database handles throttling
    },
    team: {
        // Invalidate user.* queries and specific brand paths
        routers: ["user"],
        exactPaths: [
            ["brand", "members"],
            ["brand", "invites"],
        ],
        throttleMs: 0,
    },
    jobs: {
        // Invalidate all bulk.* queries (import/export jobs)
        routers: ["bulk"],
        throttleMs: 0, // Immediate - need to see status changes right away
    },
    theme: {
        // Invalidate specific brand paths
        routers: [],
        exactPaths: [
            ["brand", "theme"],
            ["brand", "collections"],
        ],
        throttleMs: 0,
    },
} as const;

export type RealtimeDomain = keyof typeof REALTIME_DOMAINS;
export const REALTIME_DOMAIN_NAMES = Object.keys(
    REALTIME_DOMAINS,
) as RealtimeDomain[];
