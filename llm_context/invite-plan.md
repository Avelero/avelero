## Avelero Invite System — Implementation Plan

### Summary
Implement a minimal, robust invite system using Supabase Auth `auth.admin.generateLink()` with custom email delivery via Resend, secure token hashing at rest, and automatic membership claiming after authentication. The system is brand-scoped and integrates cleanly into existing tRPC, RLS, and centralized redirect flows.

### Business Logic & Flow
- **Tables**
  - `brand_invites(id, brand_id, email, role, token_hash, status, accepted_at, fulfilled_at, expires_at, created_by, created_at)`
  - `users_on_brand(user_id, brand_id, role)` (already present)

- **Send Invite**
  - Server (service role) creates `brand_invites` with `status='pending'`, `token_hash`, and `expires_at`.
  - Generate link: `auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: APP_URL + '/api/auth/accept?token=RAW' } })`.
  - If `generateLink()` returns a hashed token, store it; otherwise compute `SHA-256(rawToken)` and store the hash.
  - Send email via Resend with a React Email template. No Trigger.dev.

- **Accept Endpoint**
  - Public GET receives `token` (raw) or `token_hash`.
  - Hash raw token if provided; look up invite, validate not expired/revoked.
  - Mark invite `status='accepted'` and set `accepted_at`. Do not create membership here.
  - Redirect to normal sign-in flow (`/[locale]/(public)/login`) preserving `return_to` as needed.

- **Auto-attach on Real Identity**
  - An SQL function `public.claim_invites_for_user(user_id)` attaches all accepted, unexpired invites (by matching email) into `users_on_brand`, then marks invites `fulfilled` with `fulfilled_at`.
  - Trigger AFTER INSERT on `auth.users` calls the function to auto-attach on first sign-in.
  - Additionally, call the RPC after any successful sign-in (OAuth/OTP) to cover users who accepted an invite after account creation.

- **Onboarding Router / Redirects**
  - After session exists and claim step runs, if the user has any memberships, send them to the brand dashboard; otherwise to `/brands/create`.
  - Continue to use centralized redirects in `resolveAuthRedirectPath` and respect `return_to` unless it conflicts with invite onboarding.

---

### Files to Add / Change

#### Database (migrations)
- `apps/api/supabase/migrations/20240901xxxxxx_create_brand_invites.sql`
  - Create table `public.brand_invites` with columns listed above
  - Indexes: `(brand_id)`, `(email)`, `(status)`, `(accepted_at)`, `(expires_at)`
  - RLS policies:
    - Select: brand members can view invites for their brand; optionally allow self-select by `email = auth.jwt().email` for non-sensitive fields
    - Insert/Update/Delete: only brand owners (enforced via membership + role) or service role
  - Ensure `pgcrypto` is available if needed for SQL hashing

- `apps/api/supabase/migrations/20240901xxxxxx_claim_invites.sql`
  - SQL function `public.claim_invites_for_user(p_user_id uuid)`:
    - Join `brand_invites` (status `accepted`, not expired) to `users` by email
    - Upsert rows into `users_on_brand(user_id, brand_id, role)`
    - Mark invites `status='fulfilled'`, set `fulfilled_at`
    - Return claimed brand ids ordered by latest `accepted_at`
  - Trigger on `auth.users` AFTER INSERT to call the function

- `packages/supabase/src/types/db.ts`
  - Add type definitions for `brand_invites`

#### API (tRPC)
- `apps/api/src/trpc/routers/brand.ts` (extend existing router)
  - `sendInvite` (protected; owner only):
    - Input: `{ brand_id, email, role }`
    - Validate permissions via existing membership/owner checks
    - Create `brand_invites` row with `pending` + `expires_at`
    - Generate link via `auth.admin.generateLink()` with `redirectTo`
    - Compute/store `token_hash` if needed
    - Send email via Resend using the template (see Email section)
    - Idempotency: allow resending by creating new token and invalidating old if desired
  - `revokeInvite` (protected; owner only): mark invite `revoked`
  - `listInvites` (protected): list pending/accepted/fulfilled for a brand

- `apps/api/src/trpc/routers/_app.ts`
  - No new file; `_app.ts` remains the router aggregator

- `apps/api/src/trpc/middleware/team-permission.ts`
  - Optionally add a helper to assert brand owner role for invite actions

#### Email
- `packages/email/emails/invite.tsx`
  - Branded invite email; CTA button to `acceptUrl`
  - Includes brand name, role, expiry note
  - Explicit note: user must sign up / log in with the recipient email shown in bold

#### App API Routes and Auth Flow
- `apps/app/src/app/api/auth/accept/route.ts`
  - Public GET `?token=<raw>` or `?token_hash=<hash>`
  - Using service role: validate and set invite `accepted`
  - Redirect to `/[locale]/(public)/login?return_to=/` (preserve locale; optionally set an `invite=1` flag)

- `apps/app/src/app/api/auth/callback/route.ts` (change)
  - After successful OAuth, call `rpc.claim_invites_for_user(user.id)`
  - Continue to `resolveAuthRedirectPath`

- `apps/app/src/actions/auth/verify-otp-action.ts` (change)
  - After successful OTP verification, call `rpc.claim_invites_for_user(user.id)`
  - Continue to `resolveAuthRedirectPath`

- `apps/app/src/lib/auth-redirect.ts` (change)
  - Ensure order: profile completeness → claimed membership check → brand create fallback
  - If multiple invites exist, prefer most recently `accepted_at`

#### UI (dashboard)
- `apps/app/src/components/forms/invite-form.tsx`
  - Client component with Zod validation (email, role)
  - Calls `trpc.brand.sendInvite`

- `apps/app/src/components/brands/invites-table.tsx`
  - Table listing invites with status, email, role, expiry, revoke action

- `apps/app/src/app/[locale]/(dashboard)/brands/invites/page.tsx`
  - RSC wrapper: fetch list via tRPC, render `InviteForm` and `InvitesTable`

#### Shared queries/mutations
- `packages/supabase/src/mutations/index.ts` (change)
  - Add `createBrandInvite`, `revokeBrandInvite`

- `packages/supabase/src/queries/index.ts` (change)
  - Add `listBrandInvites`, `getUserBrandMemberships`, `getMostRecentAcceptedInviteBrand`

#### Configuration & Env
- Dependencies
  - Add `resend` to `apps/api`
  - Ensure `@supabase/supabase-js` admin client available in API layer

- Environment variables
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - `NEXT_PUBLIC_APP_URL`
  - `RESEND_API_KEY`

---

### Security & Operational Notes
- **Token storage**: store only `token_hash` (SHA-256). Prefer `hashed_token` from `generateLink()` if provided; otherwise hash raw token immediately and never persist the raw token.
- **Service role scope**: used only in send-invite (create + generate link), accept endpoint (mark accepted). Claim runs as SQL function with appropriate privileges.
- **Expiry**: set `expires_at` (e.g., 7 days). Enforce at both accept and claim time.
- **Idempotency**: accept is idempotent; claim upserts memberships and marks invites fulfilled safely. Resending either reuses valid pending invites or issues a new one while revoking older tokens.
- **Auditing**: maintain `created_by`, timestamps, and `status` transitions for traceability.
- **Rate limiting**: consider rate limits for invite creation per brand to mitigate abuse.

---

### Step-by-Step To‑Do
8) Config
   - Add `resend` dependency in `apps/api`
   - Document and set `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`

9) QA
   - E2E: invite → accept (logged-out) → sign-in → auto-attach → redirect to brand
   - Existing user: accept after account exists → claim on next sign-in
   - Revoked/expired paths and idempotency

Notes on feedback addressed:
- Invite procedures are added to the existing `brand.ts` router; no new router file.
- `_app.ts` remains the router aggregator; no extra router files are introduced.
- No Trigger.dev usage; emails are sent directly with Resend from the API.
- The invite email template will explicitly instruct the user to sign up/log in using the bolded recipient email.

### Completed Steps
1) DB
   - Add `create_brand_invites` migration with RLS
   - Add `claim_invites_for_user` function + trigger migration
   - Update `packages/supabase/src/types/db.ts`

2) Email
   - Create `packages/email/emails/invite.tsx` (include bold recipient email and expiry note)

3) API (tRPC)
   - Extend `brand.ts` with `sendInvite`, `revokeInvite`, `listInvites`
   - Add/extend brand owner guard in `team-permission.ts`

4) Accept Flow
   - Implement `apps/app/src/app/api/auth/accept/route.ts`

5) Post-Auth Claim
   - Call `claim_invites_for_user` in OAuth callback and OTP verify action

6) Redirects
   - Adjust `resolveAuthRedirectPath` to respect claimed memberships and most recent invite

7) UI
   - Implement `invite-form` and `invites-table` components
   - Add `brands/invites/page.tsx` to manage invites

