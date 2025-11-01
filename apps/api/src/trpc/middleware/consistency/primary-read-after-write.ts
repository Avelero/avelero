/**
 * Placeholder middleware that would enforce read-after-write consistency.
 *
 * The project currently runs against a single Supabase primary, so the helper
 * simply forwards the request. Keeping the hook in place makes it easy to add
 * replica syncing in the future.
 *
 * @typeParam TReturn - Response type of the downstream resolver.
 * @param opts - tRPC middleware context including the next function.
 * @returns Result of the next middleware or procedure.
 */
export async function withPrimaryReadAfterWrite<TReturn>(opts: {
  ctx: unknown;
  type: "query" | "mutation" | "subscription";
  next: (opts: { ctx: unknown }) => Promise<TReturn>;
}) {
  return opts.next({ ctx: opts.ctx });
}
