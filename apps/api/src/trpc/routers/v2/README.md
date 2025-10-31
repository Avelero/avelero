# API v2 Router Scaffold

This directory mirrors the domain-oriented endpoint structure described in
`avelero/docs/NEW_API_ENDPOINTS.txt`. Each router exports placeholders so the
new implementation can be built incrementally without touching the legacy
`routers/*.ts` files.

## Structure

- `index.ts` – central router that wires the domain routers together. Hook
  this into `_app.ts` once individual domains are migrated.
- `user/` – home for `user.*` procedures.
- `workflow/` – brand lifecycle plus nested `members` and `invites`.
- `brand/` – catalog resources (`colors`, `sizes`, `materials`, etc.).
- `products/` – product CRUD, `variants`, and nested `attributes`.
- `passports/` – passport CRUD with nested `templates`.
- `bulk/` – shared bulk mutations.
- `composite/` – combined reads for performance-sensitive views.

Each router currently throws a `Not implemented` error to keep call-sites
honest while you fill in the real logic.

## Suggested Migration Flow

1. Implement the new procedures inside the relevant router.
2. Add Zod schemas under `apps/api/src/schemas` as needed.
3. Switch consumers to the `apiV2Router` namespace.
4. Delete or adapt the legacy routers once the migration is complete.
