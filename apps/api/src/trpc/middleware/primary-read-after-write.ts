// Minimal placeholder middleware for read-after-write consistency.
// In this repo we use Supabase (single primary). Keep as no-op for now.

export async function withPrimaryReadAfterWrite<TReturn>(opts: {
  ctx: unknown;
  type: "query" | "mutation" | "subscription";
  next: (opts: { ctx: unknown }) => Promise<TReturn>;
}) {
  return opts.next({ ctx: opts.ctx });
}
