<plan>
# Sales-Led Billing + Invite-Only Workspace Provisioning (Phased Implementation Plan)

## Summary

This plan decomposes the full refactor into phase-sized implementation tickets that can be executed in separate agent sessions without requiring runtime fallback logic.

The target end state is:

- `sales-led, admin-provisioned` brand/workspace setup
- `invite-only` onboarding for all users (new and existing users use token invite links)
- centralized access gating based on `membership + brand lifecycle + billing state`
- founder-only `/admin` console inside the existing app
- Stripe integration with `Checkout` for standard plans and `Invoices/Quotes` for custom enterprise
- no public self-serve brand creation

This plan is designed to be decision-complete at a high level so each phase can be handed to a separate implementation agent.

## Current State Anchors (Repo Facts)

These are the current components that the phases will refactor.

- Auth session proxy is in `/Users/rafmevis/avelero-v2/apps/app/src/proxy.ts` (Next.js 16 `proxy.ts`, not `middleware.ts`)
- Invite token cookie is set in `/Users/rafmevis/avelero-v2/apps/app/src/app/api/auth/accept/route.ts`
- OAuth callback attempts invite redemption in `/Users/rafmevis/avelero-v2/apps/app/src/app/api/auth/callback/route.ts`
- OTP flow also attempts invite redemption in `/Users/rafmevis/avelero-v2/apps/app/src/actions/auth/verify-otp-action.ts`
- Generic auth redirect currently sends no-brand users to `/create-brand` in `/Users/rafmevis/avelero-v2/apps/app/src/lib/auth-redirect.ts`
- Dashboard layout also redirects to `/create-brand` / `/invites` in `/Users/rafmevis/avelero-v2/apps/app/src/app/(dashboard)/(main)/layout.tsx`
- Self-serve create-brand UI exists in `/Users/rafmevis/avelero-v2/apps/app/src/app/(dashboard)/create-brand/page.tsx` and `/Users/rafmevis/avelero-v2/apps/app/src/components/forms/create-brand-form.tsx`
- Brand selector exposes `Create Brand` in `/Users/rafmevis/avelero-v2/apps/app/src/components/select/brand-select.tsx`
- Existing owner-only brand invite sending is implemented in `/Users/rafmevis/avelero-v2/apps/api/src/trpc/routers/brand/invites.ts`
- Existing brand create backend seeds theme/catalog and membership in `/Users/rafmevis/avelero-v2/packages/db/src/queries/brand/brands.ts`

## Program Rules (Chosen for This Plan)

- No dual runtime modes (`self-serve` vs `sales-led`) after cutover phases complete
- Token invite links for all invite recipients (existing and new users)
- Exact invite email match enforced server-side on acceptance
- Account creation is pre-auth gated: allowed only for existing auth users or emails with pending invites
- Post-auth signout fallbacks are safety nets only, never the primary invite-only signup enforcement
- Token-link invite redemption remains the primary instant-membership path; pending-invite signup without token click is allowed and routes to `/invites`
- Explicit login errors for non-invited/no-account attempts are allowed in this program (`account_not_found` behavior is intentional)
- `/admin` is implemented inside the existing app (`app.avelero.com/admin`), not a separate admin app
- Platform admin authorization uses an explicit allowlist (not domain-only)
- Billing is attached to `brand` (workspace), not `user`
- Standard plans use Stripe Checkout; custom enterprise uses Stripe Invoices/Quotes
- Google OAuth and OTP both remain supported in invite-only mode
- No invite domain whitelist feature in this program (explicit email invites only, any domain)

## Phase Breakdown (One Agent Session Per Phase)

## Phase 0: Foundations and Data Model (Statuses, Admin Auth, Audit Scaffolding)

- Goal: Introduce the new core domain model so later phases build on stable primitives.
- Scope: Database schema changes for brand lifecycle and billing metadata scaffolding, platform admin guard, audit log table, shared access decision types.
- Deliverables:
- Add brand lifecycle fields to the brand domain (or a 1:1 brand settings table if preferred by implementation, but this plan defaults to brand-level fields).
- Add canonical plan fields:
- `plan_type`: `starter | growth | scale | custom`
- `plan_currency`: default `EUR`
- `custom_monthly_price_cents`: nullable (required when `plan_type=custom`)
- Add lifecycle fields:
- `qualification_status`: `pending | qualified | rejected`
- `operational_status`: `active | suspended`
- Add billing coordination fields (non-Stripe-source-of-truth):
- `billing_mode`: `standard_checkout | enterprise_invoice`
- `billing_access_override`: `none | temporary_allow | temporary_block`
- Add admin audit log table for platform-admin actions (brand provisioning, status changes, invite actions, billing actions).
- Add shared server helper for platform admin allowlist check from env (`PLATFORM_ADMIN_EMAILS`).
- Add TRPC/app route guard helper for `platformAdminProcedure`.
- Define shared `BrandAccessDecision` type and centralized decision function interface (implementation logic can be stubbed here; full enforcement comes later).
- Important API/interface additions:
- New env var: `PLATFORM_ADMIN_EMAILS` (comma-separated normalized emails)
- New server helper: `isPlatformAdminEmail(email: string | null): boolean`
- New TRPC middleware/procedure wrapper: `platformAdminProcedure`
- New shared type: `BrandAccessDecision`
- Acceptance criteria:
- Schema compiles and types regenerate cleanly
- Existing brand flows continue to compile after field additions
- Platform admin guard utilities are available for later phases
- Audit log write interface exists (even if only minimally used yet)
- Handoff notes for next phase:
- Include exact enum names and normalized mapping constants so later agents do not invent alternatives

## Phase 1: Invite System Refactor (Token-Only for Everyone + Bug Fix)

- Goal: Make invite acceptance reliable and token-based for all users, and fix the current bug where invited users land on `/create-brand`.
- Scope: Invite generation, auth callback/OTP redemption, invite error handling, removal of existing/new-user branching in invite emails.
- Deliverables:
- Update invite send logic so all invite emails use token links (`/api/auth/accept?token_hash=...`) for both existing and new users.
- Remove branching that sends existing users to `/invites` from `/Users/rafmevis/avelero-v2/apps/api/src/trpc/routers/brand/invites.ts`.
- Fix invite redemption timing bug by ensuring invite acceptance can succeed for brand-new users even when `public.users` profile row is not yet present.
- Preferred implementation rule: invite redemption must not fail because the profile row is absent; create missing profile row before or during redemption.
- Stop swallowing invite redemption errors in OAuth callback and OTP flow.
- Surface explicit invite errors via redirect query state (examples: `expired`, `wrong_email`, `already_used`, `accept_failed`).
- Add clear login-page error rendering for invite failures.
- Enforce exact email match server-side for invite redemption and keep it as the source of truth.
- Support authenticated-user token link clicks (if already signed in with matching email, redeem immediately without unnecessary re-login).
- Remove manual user-facing invite acceptance as the primary flow.
- Important API/interface changes:
- Invite email payload contract changes: `acceptUrl` is always token-link-based
- New structured invite error codes in auth callback/login UI query params
- If RPC is replaced/upgraded: define a structured return contract (`status`, `brand_id`, `error_code`) instead of relying on raw exception text
- Acceptance criteria:
- New user invite link -> Google sign-in -> lands in invited brand (not `/create-brand`)
- Existing user invite link -> sign-in or immediate accept -> lands in invited brand
- Wrong Google account -> clear error and no membership created
- Expired/revoked token -> clear error and no membership created
- No invite email branch remains that links to `/invites`
- Handoff notes for next phase:
- Document final invite token acceptance path and error query params for redirect/onboarding refactor

## Phase 2: Invite-Only Auth and Onboarding Redirect Refactor (No Public Brand Creation)

- Goal: Remove self-serve brand creation assumptions from auth/onboarding and replace them with invite-only / pending-access behavior.
- Scope: Auth redirect logic, dashboard layouts, setup flow, no-brand UX, login copy, create-brand route exposure.
- Deliverables:
- Replace all `no brand => /create-brand` redirects with:
- `/invites` only if token-based acceptance is not yet completed and there are pending invites to inspect (optional)
- `/pending-access` as the default no-brand destination for non-members
- Create `/pending-access` page with clear sales-led messaging (contact founders / wait for invite / billing pending message if applicable).
- Update `/Users/rafmevis/avelero-v2/apps/app/src/lib/auth-redirect.ts` to stop treating brand creation as default onboarding.
- Update `/Users/rafmevis/avelero-v2/apps/app/src/app/(dashboard)/(main)/layout.tsx` redirect logic to invite-only behavior.
- Update `/Users/rafmevis/avelero-v2/apps/app/src/components/forms/setup-form.tsx` post-profile redirect logic to route to `/pending-access` instead of `/create-brand`.
- Update login page copy in `/Users/rafmevis/avelero-v2/apps/app/src/app/(public)/login/page.tsx` so it does not advertise public account creation.
- Keep Google + OTP auth methods, but both become invite-only in practical access terms.
- Remove or hide customer-facing entry points to brand creation:
- brand selector create action
- brands page create button
- invites page copy referencing brand creation
- Decide route treatment for `/create-brand`:
- public users: blocked/redirected
- platform admins: allowed only if retained for internal use
- Important API/interface additions:
- New route: `/pending-access`
- New shared redirect decision helper states: `needs_profile`, `pending_access`, `has_brand_access`
- Acceptance criteria:
- Non-invited authenticated user never sees `/create-brand`
- Invited authenticated user with successful invite acceptance reaches app brand context
- Platform admin users can still provision brands (via current route temporarily or future admin route)
- No customer-visible UI exposes “Create Brand”
- Handoff notes for next phase:
- List of removed redirect assumptions and pages/components now expecting centralized access checks

## Phase 2A: Pre-Auth Invite-Only Signup Enforcement (OTP + Google)

- Goal: Prevent auth user creation for non-invited emails while preserving invite-first onboarding.
- Scope: OTP eligibility preflight, Google OAuth signup guard via Supabase auth hook, callback/login error normalization, and no-membership redirect split (`/invites` vs `/pending-access`).
- Deliverables:
- Add helper DB function `has_pending_invite_email(email)` used as source-of-truth for signup eligibility.
- Add helper DB function `has_auth_user_email(email)` used for OTP preflight decisions.
- Add Supabase `before_user_created` auth hook function that rejects non-invited new-user creation with deterministic error (`account_not_found`).
- Configure Supabase `before_user_created` hook in `apps/api/supabase/config.toml`.
- Add OTP preflight server action returning: `existing_account | pending_invite | not_found`.
- Update OTP send-code flow:
- `existing_account` => `shouldCreateUser=false`
- `pending_invite` => `shouldCreateUser=true`
- `not_found` => block send and show explicit error
- Map OAuth callback auth-code exchange failures from hook rejections to deterministic login error query state (`error=account_not_found`).
- Remove post-auth invite-only signout as the primary account-creation guard.
- Update no-membership redirect resolution:
- pending invites exist => `/invites`
- no pending invites => `/pending-access`
- Important API/interface additions:
- Supabase hook function: `before_user_created_invite_gate(event jsonb) -> jsonb`
- Supabase helper functions: `has_pending_invite_email(text) -> boolean`, `has_auth_user_email(text) -> boolean`
- New login error code/query state: `account_not_found`
- New OTP preflight action response contract: `existing_account | pending_invite | not_found`
- Acceptance criteria:
- Non-invited + no existing account + OTP: no account created, explicit error shown
- Non-invited + no existing account + Google: no account created, explicit error shown
- Invited + new account + no token redemption: login succeeds and redirects to `/invites`
- Invited + token flow: invite redeems and user lands in brand app context
- Existing user + no membership + no pending invites: `/pending-access`

## Phase 3: Centralized Access Policy Engine and Product Gating Baseline

- Goal: Create one source of truth for brand access decisions and start enforcing it consistently.
- Scope: Access decision service, server-side gating hooks, initial gated actions/pages, shared UI state contract.
- Deliverables:
- Implement centralized access policy function (server-side) that takes:
- `user membership`
- `brand lifecycle status`
- `billing status` (placeholder/local state if Stripe not integrated yet)
- `operational status`
- `billing_access_override`
- Returns a normalized decision:
- `allowed`
- `blocked_pending_qualification`
- `blocked_pending_payment`
- `blocked_past_due`
- `blocked_suspended`
- `blocked_no_membership`
- `blocked_no_active_brand`
- Integrate this decision into shared server query/bootstrap used by dashboard layouts (`composite.initDashboard` or a sibling access bootstrap endpoint).
- Add baseline UI gating surfaces for blocked states (page-level banners/guard screens).
- Define the initial set of features gated before payment:
- core product actions (brand creation is already removed for customers)
- brand operational workflows
- Keep low-risk onboarding/profile/account pages accessible
- Important API/interface changes:
- `composite.initDashboard` (or new `composite.initAppContext`) includes `brandAccessDecision`
- Shared type for UI consumption: `BrandAccessDecision`
- Acceptance criteria:
- A brand marked qualified + billing active can access product
- A brand marked qualified + billing pending cannot access core product and sees correct messaging
- A brand marked suspended is blocked regardless of billing state
- No duplicated ad hoc gating logic in multiple pages for the same access rule
- Handoff notes for next phase:
- Admin backend/API must write statuses in the exact shapes expected by this access engine

## Phase 4: Platform Admin Backend (TRPC Admin Routers + Audit Logging)

- Goal: Build the backend control plane for founders to provision and manage brands without using Supabase Studio.
- Scope: Admin TRPC routers, platform admin auth enforcement, audit logging on writes, reuse of existing brand creation seed logic.
- Deliverables:
- Add `admin` TRPC namespace guarded by `platformAdminProcedure`.
- Add admin brand list/search query.
- Add admin brand detail query with:
- lifecycle fields
- plan fields
- current members
- pending invites
- billing summary placeholder
- Add admin brand create mutation that reuses existing brand creation backend logic (seed theme/catalog + founder membership).
- Add admin brand update mutation for lifecycle + plan fields.
- Add admin membership management mutations:
- add founder/internal member
- remove member
- promote/demote role (if needed)
- Add admin invite send/revoke mutations (can reuse brand invite logic while bypassing active-brand-context coupling).
- Emit audit log entries for every admin mutation.
- Important API/interface additions:
- `admin.brands.list`
- `admin.brands.get`
- `admin.brands.create`
- `admin.brands.updateLifecycle`
- `admin.members.add`
- `admin.members.remove`
- `admin.invites.send`
- `admin.invites.revoke`
- `admin.audit.list` (optional read endpoint if UI phase includes audit tab)
- Acceptance criteria:
- Platform admin can create a brand without manual DB edits and seeded defaults are present
- Platform admin can set plan + statuses and audit log captures the change
- Platform admin can add/remove self from customer brand
- Non-platform-admin cannot call admin endpoints
- Handoff notes for next phase:
- Provide exact endpoint payloads/response shapes for UI implementation

## Phase 5: Platform Admin UI (`/admin`) for Brand Provisioning and Management

- Goal: Deliver the founder-facing control panel in the existing app.
- Scope: `/admin` route shell, brand list, brand detail page, forms for provisioning and status management, member/invite controls.
- Deliverables:
- `/admin` landing/dashboard
- `/admin/brands` list page with search
- `/admin/brands/new` creation page (name, logo, country minimum)
- `/admin/brands/[brandId]` detail page with sections:
- brand identity (name/logo/country)
- lifecycle status (`qualification_status`, `operational_status`)
- plan (`starter | growth | scale | custom`)
- custom price input (when custom)
- billing mode (`standard_checkout` / `enterprise_invoice`)
- members table + add/remove founder/internal member
- pending invites + send/revoke invite
- audit log feed (if included in phase)
- Founder-only route guard for `/admin` pages
- Clear visual distinction that this is platform admin, not customer-facing brand settings
- Important UI constraints:
- URL key uses `brandId`, not brand name
- No create-brand UI remains in customer-facing surfaces
- Acceptance criteria:
- Founder can provision a demo brand end-to-end from `/admin`
- Founder can invite a customer admin from `/admin`
- Founder can set status to qualified and billing pending
- Founder can remove self after onboarding
- Handoff notes for next phase:
- Admin UI should already expose plan/billing mode fields expected by Stripe integration phase

## Phase 6: Stripe Billing Backend Integration (Checkout + Invoices/Quotes + Webhooks + Sync)

- Goal: Implement the billing engine and local billing sync for brand-level subscription state.
- Scope: Stripe integration on server side, local billing tables, webhook processing, idempotency, brand linkage, admin-triggered billing actions.
- Deliverables:
- Add local billing tables:
- `brand_billing_accounts` (brand -> Stripe customer)
- `brand_billing_subscriptions` (mirrored current + history records)
- `stripe_webhook_events` (idempotency + logging)
- `brand_billing_intents` or `brand_checkout_sessions` (optional but recommended for traceability)
- Implement Stripe server integration for standard plans:
- create hosted Checkout Session per brand
- attach brand metadata (`brand_id`, `plan_type`, admin actor)
- Implement enterprise billing path:
- create Stripe Quote and/or Invoice (based on chosen `enterprise_invoice` mode)
- attach brand metadata
- Implement webhook endpoint(s) to sync:
- checkout completion
- invoice paid/payment failed
- subscription created/updated/deleted
- Normalize Stripe statuses into local `billing_status` used by access policy.
- Add admin backend endpoints to create/retrieve billing payment links:
- standard Checkout activation link
- enterprise invoice/quote link/status
- Important API/interface additions:
- `admin.billing.createCheckoutSession`
- `admin.billing.createEnterpriseInvoiceOrQuote`
- `admin.billing.getBrandBillingSummary`
- public/internal webhook route for Stripe
- Shared billing status mapper (`Stripe -> local billing status`)
- Acceptance criteria:
- Standard plan brand can receive Checkout link and webhook updates local billing state to active after payment
- Enterprise brand can receive invoice/quote and payment updates local billing state to active
- Webhooks are idempotent
- Billing is linked to brand, not user
- Handoff notes for next phase:
- Expose stable billing status query contract for customer-facing billing/paywall UI

## Phase 7: Billing UX, Activation Flow, and Full Access Enforcement

- Goal: Connect Stripe billing states to customer-facing app UX and make access transitions frictionless.
- Scope: Billing activation pages, paywall screens, admin-to-customer handoff flow, gated feature UX, status banners.
- Deliverables:
- Customer-facing billing activation page/section inside app (brand-scoped)
- If `qualified + pending_payment`, show plan summary + `Pay now` CTA (standard) or invoice/quote instructions (enterprise)
- If `active`, hide activation paywall and allow core product usage
- If `past_due` or `canceled`, show blocked state and recovery actions
- Integrate centralized access policy enforcement across core brand routes/actions (server and UI)
- Add `Manage Billing` entry point if in scope for this phase (Stripe portal optional; not required if admin-driven changes remain the model)
- Update admin UI to show real-time billing summary from Stripe sync
- Acceptance criteria:
- Qualified brand with pending payment sees paywall/activation, not full product
- Payment success via webhook unlocks product without manual DB edits
- Payment failure/past_due blocks according to policy
- Admin and customer both see consistent billing state
- Handoff notes for next phase:
- Document all removed legacy paths and final access matrices for cleanup/backfill work

## Phase 8: Cutover Cleanup, Backfill, and Regression Hardening

- Goal: Remove legacy self-serve assumptions and finalize the sales-led system as the only supported path.
- Scope: Cleanup dead code/UI, migrations/backfill for existing brands, tests, observability, docs/runbooks.
- Deliverables:
- Remove or hard-disable legacy manual invite acceptance UI and obsolete TRPC endpoints if no longer used
- Remove or admin-gate legacy `/create-brand` route and all customer-facing links
- Backfill lifecycle/plan/billing fields for existing brands with explicit defaults
- Add operational runbook for founders:
- create brand
- prep demo
- invite customer
- qualify brand
- trigger payment
- verify activation
- remove founder membership
- Add logging/monitoring around:
- invite redemption errors
- webhook failures
- access policy denials
- admin mutations
- Complete regression suite for auth/invite/brand/billing flows
- Acceptance criteria:
- No customer path depends on self-serve brand creation
- No existing invite flow points to manual accept path
- Existing brands/users continue to function after backfill with deterministic default statuses
- Founders can operate entirely from `/admin` + Stripe without Supabase Studio row edits
- Final output artifact:
- “System Map” doc listing statuses, transitions, admin actions, and access rules

## Public APIs / Interfaces / Types (Planned Additions and Changes)

## Routes (App)

- New: `/admin`
- New: `/admin/brands`
- New: `/admin/brands/new`
- New: `/admin/brands/[brandId]`
- New: `/pending-access`
- Updated behavior: `/create-brand` (blocked for non-platform-admins; eventually removed or kept internal-only)

## TRPC Namespaces (API)

- New `admin.*` namespace (platform-admin-only)
- `admin.brands.*` for brand provisioning and lifecycle/plan management
- `admin.members.*` for member management
- `admin.invites.*` for token-invite operations
- `admin.billing.*` for Checkout/Invoice/Quote generation and status summary
- Updated `brand.invites.send`: token-link for all recipients (no existing/new-user split)
- Deprecated/removed `user.invites.accept` and `user.invites.reject` (manual acceptance flow)
- Updated `composite.initDashboard` or replacement endpoint to include centralized access decision

## Database / Types

- Brand lifecycle and plan fields (brand-scoped)
- Billing tables for Stripe linkage and subscription sync
- Audit log table for platform admin actions
- Generated DB types updated in `/Users/rafmevis/avelero-v2/packages/supabase/src/types/db.ts` after migrations/types generation
- Shared enums/constants for:
- plan types
- qualification status
- operational status
- local billing status
- access decision codes

## Test Cases and Scenarios (Cross-Phase Acceptance Matrix)

1. Invited new user, correct Google account:
- Click token link
- Sign in with Google
- Invite is redeemed
- User is added to brand
- User lands in brand app context
- No `/create-brand` redirect

2. Invited existing user, correct account:
- Click token link while signed out or signed in
- Invite is redeemed
- Membership created/elevated as needed
- User lands in correct brand context

3. Wrong-account invite attempt:
- Token link clicked
- User signs in with non-invited email
- No membership created
- Clear invite error shown
- User instructed to use invited email / request new invite

4. Expired/revoked token:
- Token link clicked
- Auth completes or token preflight fails
- Clear expired/revoked message shown
- No unintended brand access

5. Non-invited user login/signup attempt:
- OTP and Google both reject new auth user creation pre-auth
- No auth user is created
- Clear `account_not_found` login error is shown

6. Invited user signup without token-redemption flow:
- User signs in via OTP or Google with an email that has a pending invite
- New auth account may be created
- If no membership yet, redirect goes to `/invites`

7. Platform admin auth:
- Allowed email can access `/admin` and call `admin.*`
- Non-allowed email cannot access `/admin` or `admin.*`

8. Admin brand provisioning:
- Founder creates brand via `/admin`
- Seeded defaults exist (theme/catalog)
- Founder membership exists
- Audit log entry recorded

9. Admin invite flow:
- Founder sends customer invite from `/admin`
- Token email generated for all recipients
- Revoke works and revoked token cannot be accepted

10. Standard plan billing:
- Admin marks brand qualified + standard plan
- Checkout session generated
- Payment succeeds
- Webhook updates local billing status
- Access policy unlocks product

11. Enterprise/custom billing:
- Admin sets custom plan + price + `enterprise_invoice`
- Quote/invoice generated
- Payment recorded via Stripe
- Local billing status activates
- Access unlocks

12. Billing failure states:
- Stripe webhook sends payment failure/past_due
- Local billing state updates
- Access decision blocks core product
- UI shows recovery messaging

13. Founder temporary access lifecycle:
- Founder added to customer brand for demo/support
- Founder removed afterward
- Brand selector no longer cluttered by removed brand memberships

14. Legacy path cleanup:
- Customer-facing UI contains no “Create Brand”
- No redirects target `/create-brand` for non-admin users
- Manual invite acceptance UI path is gone or non-functional by design

## Assumptions and Defaults (Locked for This Plan)

- Platform admin authorization: explicit allowlist (`PLATFORM_ADMIN_EMAILS`), not domain-only
- Auth methods in scope: Google OAuth and OTP both supported in invite-only mode
- Pre-auth account creation eligibility: `existing auth account` OR `pending invite email`
- Invite acceptance: token-link flow for everyone; manual accept/reject flow removed
- Invite security: exact email match enforced server-side during acceptance
- Admin app location: same app under `/admin`, no separate admin subdomain/app
- Whitelisting: out of scope for this program; explicit invites to any email are allowed
- Billing:
- Standard tiers (`starter`, `growth`, `scale`) use Stripe Checkout
- Custom/enterprise uses Stripe Invoices/Quotes
- Billing is brand-scoped
- Plan cadence: monthly pricing only in this implementation unless existing product requirements already mandate annual billing
- Support model: founders use temporary membership on customer brands; no separate support-impersonation system in this program
- Runtime rollout: no permanent dual-path self-serve/sales-led logic after cutover phases complete

## Recommended Execution Order for Multi-Agent Sessions

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 2A
5. Phase 3
6. Phase 4
7. Phase 5
8. Phase 6
9. Phase 7
10. Phase 8

This order minimizes rework by locking data model and invite behavior before redirect/gating/admin/billing UI layers.

**Updated Master Plan (With Progress)**

## Program Status (as of February 25, 2026)

| Phase | Status | Notes |
|---|---|---|
| Phase 0: Foundations | `Completed` | Implemented schema/query/server foundations, migration, backfill, local migrate, typegen, typecheck, lint |
| Phase 1: Invite Refactor + Bug Fix | `Completed` | Token-only invites, structured invite redemption contract, OAuth/OTP error propagation, login invite error UX, typecheck, lint |
| Phase 2: Invite-Only Auth/Redirect Refactor | `Completed` | `/pending-access` flow implemented, no-brand redirects updated, create-brand customer entry points removed, `/create-brand` + `user.brands.create` admin-gated, typecheck, lint |
| Phase 2A: Pre-Auth Invite-Only Signup Enforcement | `Completed` | OTP + Google pre-auth account-creation gate and deterministic auth error handling implemented |
| Phase 3: Central Access Policy Enforcement | `Completed` | Centralized access policy decisions are integrated into composite bootstrap and app gating |
| Phase 4: Admin Backend (`admin.*`) | `In Progress` | Implementing `admin.*` namespace, admin mutations, and audit-integrated backend flows |
| Phase 5: Admin UI (`/admin`) | `Pending` | Depends on Phase 4 endpoints |
| Phase 6: Stripe Backend + Webhooks | `Pending` | Depends on Phase 0 brand control states |
| Phase 7: Billing UX + Full Gating | `Pending` | Depends on Phases 3 and 6 |
| Phase 8: Cutover Cleanup + Hardening | `Pending` | Final cleanup/backfill/regression hardening |

## Phase 0 Completed (Implemented)

### Foundations added
- `brand_control` table (1:1 brand commercial/lifecycle state)
  - `/Users/rafmevis/avelero-v2/packages/db/src/schema/brands/brand-control.ts`
- `platform_admin_audit_logs` table
  - `/Users/rafmevis/avelero-v2/packages/db/src/schema/core/platform-admin-audit-logs.ts`
- Schema exports wired
  - `/Users/rafmevis/avelero-v2/packages/db/src/schema/index.ts`

### Query helpers added
- Brand control helpers (`createDefaultBrandControl`, `getBrandControlByBrandId`, `upsertBrandControl`)
  - `/Users/rafmevis/avelero-v2/packages/db/src/queries/brand/control.ts`
- Admin audit helpers
  - `/Users/rafmevis/avelero-v2/packages/db/src/queries/admin/audit.ts`
  - `/Users/rafmevis/avelero-v2/packages/db/src/queries/admin/index.ts`
- Query barrels updated
  - `/Users/rafmevis/avelero-v2/packages/db/src/queries/brand/index.ts`
  - `/Users/rafmevis/avelero-v2/packages/db/src/queries/index.ts`

### Brand creation now seeds control row
- `createBrand(...)` now inserts default `brand_control` in the same transaction
  - `/Users/rafmevis/avelero-v2/packages/db/src/queries/brand/brands.ts:260`

### Platform admin guard foundations added
- Env helpers (`getPlatformAdminEmails`, `isPlatformAdminEmail`)
  - `/Users/rafmevis/avelero-v2/packages/utils/src/envs.ts:56`
- TRPC middleware + `platformAdminProcedure`
  - `/Users/rafmevis/avelero-v2/apps/api/src/trpc/middleware/auth/platform-admin.ts`
  - `/Users/rafmevis/avelero-v2/apps/api/src/trpc/init.ts:293`

### Shared access policy vocabulary added (not enforced yet)
- Status constants, access decision constants/types, `resolveBrandAccessDecision(...)`
  - `/Users/rafmevis/avelero-v2/apps/api/src/lib/access/brand-access.ts`

### Migration + backfill completed
- Generated migration:
  - `/Users/rafmevis/avelero-v2/apps/api/supabase/migrations/20260225143757_closed_steve_rogers.sql`
- Backfill SQL added for existing brands (`brand_control`)
  - `/Users/rafmevis/avelero-v2/apps/api/supabase/migrations/20260225143757_closed_steve_rogers.sql:45`
- Supabase generated types updated
  - `/Users/rafmevis/avelero-v2/packages/supabase/src/types/db.ts`

### Env example updated
- Added `PLATFORM_ADMIN_EMAILS`
  - `/Users/rafmevis/avelero-v2/apps/api/.env.example:4`

## Phase 0 Validation Completed

- `bun db:generate` ✅ (from `/Users/rafmevis/avelero-v2/packages/db`)
- `bun db:migrate` ✅
- `bun types:generate` ✅ (from `/Users/rafmevis/avelero-v2/packages/supabase`)
- `bun typecheck` ✅
- `bun lint` ✅

## Phase 1 Completed (Implemented)

### Invite send path is now token-only
- Removed existing/new-user branching from invite send payload generation
  - `/Users/rafmevis/avelero-v2/apps/api/src/trpc/routers/brand/invites.ts`
- Removed `isExistingUser` coupling from DB invite creation result
  - `/Users/rafmevis/avelero-v2/packages/db/src/queries/brand/invites.ts`
- Removed unused `ctaMode` invite payload fields
  - `/Users/rafmevis/avelero-v2/packages/jobs/src/trigger/invite.ts`
  - `/Users/rafmevis/avelero-v2/packages/email/emails/invite.tsx`

### Invite redemption contract + bug fix foundations
- Added migration replacing `accept_invite_from_cookie(text)` with structured return:
  - returns `{ status, brand_id, error_code }`
  - ensures `public.users` row exists before `brand_members` write
  - keeps strict invited-email match enforcement
  - `/Users/rafmevis/avelero-v2/apps/api/supabase/migrations/20260225170000_phase1_invite_redemption.sql`
- Updated Supabase DB function type signature
  - `/Users/rafmevis/avelero-v2/packages/supabase/src/types/db.ts`

### App auth flows now use shared redemption + explicit errors
- Added shared helper for token normalization, redemption, and error mapping:
  - `/Users/rafmevis/avelero-v2/apps/app/src/lib/auth/invite-redemption.ts`
- `/api/auth/accept` now:
  - validates token (`token_hash` primary, `token` fallback)
  - redeems immediately if already authenticated
  - redirects with `invite_error` on failures
  - `/Users/rafmevis/avelero-v2/apps/app/src/app/api/auth/accept/route.ts`
- OAuth callback and OTP verify action now:
  - no longer swallow invite redemption failures
  - clear invite cookie after attempt
  - redirect with explicit `invite_error` on failure
  - `/Users/rafmevis/avelero-v2/apps/app/src/app/api/auth/callback/route.ts`
  - `/Users/rafmevis/avelero-v2/apps/app/src/actions/auth/verify-otp-action.ts`

### Login invite error UX added
- Added login alert component that renders deterministic `invite_error` and known auth `error` states
  - `/Users/rafmevis/avelero-v2/apps/app/src/components/auth/login-alert.tsx`
- Wired alert into login page
  - `/Users/rafmevis/avelero-v2/apps/app/src/app/(public)/login/page.tsx`

## Phase 1 Validation Completed

- `bun typecheck` ✅
- `bun lint` ✅

## Phase 2 Completed (Implemented)

### Redirect and onboarding behavior refactor
- Added `/pending-access` route with no-membership guidance and recovery actions:
  - `/Users/rafmevis/avelero-v2/apps/app/src/app/(dashboard)/pending-access/page.tsx`
- Added reusable sign-out action button for pending access:
  - `/Users/rafmevis/avelero-v2/apps/app/src/components/auth/sign-out-button.tsx`
- `resolveAuthRedirectPath(...)` now routes no-membership users to `/pending-access`:
  - `/Users/rafmevis/avelero-v2/apps/app/src/lib/auth-redirect.ts`
- Main dashboard layout now routes no-membership users to `/pending-access`:
  - `/Users/rafmevis/avelero-v2/apps/app/src/app/(dashboard)/(main)/layout.tsx`
- Setup completion no longer redirects to create-brand/invites fallback:
  - `/Users/rafmevis/avelero-v2/apps/app/src/components/forms/setup-form.tsx`

### No-brand edge flow handling (leave/delete)
- Leaving the last brand now redirects to `/pending-access`:
  - `/Users/rafmevis/avelero-v2/apps/app/src/hooks/use-brand.ts`
- Deleting the last brand now redirects to `/pending-access`:
  - `/Users/rafmevis/avelero-v2/apps/app/src/components/modals/delete-brand-modal.tsx`

### Customer create-brand entry points removed
- Removed create-brand action from brand selector:
  - `/Users/rafmevis/avelero-v2/apps/app/src/components/select/brand-select.tsx`
- Removed create-brand button from account brands table header and skeleton:
  - `/Users/rafmevis/avelero-v2/apps/app/src/components/tables/brands/brands-header.tsx`
  - `/Users/rafmevis/avelero-v2/apps/app/src/components/tables/brands/skeleton.tsx`
- Updated invite page copy to invite-only wording:
  - `/Users/rafmevis/avelero-v2/apps/app/src/app/(dashboard)/invites/page.tsx`

### Admin-only create-brand enforcement
- Added app-side platform admin email helper:
  - `/Users/rafmevis/avelero-v2/apps/app/src/lib/platform-admin.ts`
- `/create-brand` page now redirects non-admin users to `/pending-access`:
  - `/Users/rafmevis/avelero-v2/apps/app/src/app/(dashboard)/create-brand/page.tsx`
- `user.brands.create` now requires `platformAdminProcedure`:
  - `/Users/rafmevis/avelero-v2/apps/api/src/trpc/routers/user/index.ts`

### Auth and navigation copy updates
- Updated login page copy for invite-only language:
  - `/Users/rafmevis/avelero-v2/apps/app/src/app/(public)/login/page.tsx`
- Added breadcrumb label mapping for pending-access:
  - `/Users/rafmevis/avelero-v2/apps/app/src/components/header-navigation.tsx`

### Env example updates
- Added `PLATFORM_ADMIN_EMAILS` to app env example (used by app route guard):
  - `/Users/rafmevis/avelero-v2/apps/app/.env.example`
- Added `NEXT_PUBLIC_SUPPORT_EMAIL` to app env example (optional pending-access CTA):
  - `/Users/rafmevis/avelero-v2/apps/app/.env.example`

## Phase 2 Validation Completed

- `bun typecheck` ✅
- `bun lint` ✅

## Remaining follow-up from Phase 1 implementation

- Apply the new invite redemption migration in the target DB environment(s):
  - `bun db:migrate`
- Regenerate Supabase types after migration application:
  - `cd /Users/rafmevis/avelero-v2/packages/supabase && bun types:generate`

## Defaults Now Locked in Code (Phase 0)

- `qualification_status = pending`
- `operational_status = active`
- `billing_status = unconfigured`
- `billing_mode = null`
- `billing_access_override = none`
- `plan_type = null`
- `plan_currency = EUR`
- `custom_monthly_price_cents = null`

## Updated High-Level Plan (Rebased After Phase 2)

### Phase 1 (Completed): Invite Token-Only Refactor + Invite Acceptance Bug Fix
- Token-link invites are now the only invite path for all users
- Existing/new-user branching in invite send logic was removed
- Invite redemption now returns structured status/error codes
- OAuth + OTP flows now surface explicit invite errors
- Login page now renders deterministic invite/auth error states

### Phase 2 (Completed): Invite-Only Auth and Redirect Refactor
- Replaced `/create-brand` no-brand redirects with `/pending-access`
- Added `/pending-access` page with invite/account-recovery actions
- Removed customer-facing create-brand entry points
- Admin-gated `/create-brand` page and `user.brands.create`
- Updated login/invite copy to match invite-only access

### Phase 2A: Pre-Auth Invite-Only Signup Enforcement
- Add `before_user_created` hook gate for Google/OTP new-user creation
- OTP preflight chooses `shouldCreateUser` from `existing_account | pending_invite | not_found`
- Map blocked signup failures to deterministic login error (`account_not_found`)
- Route no-membership users with pending invites to `/invites`

### Phase 3: Centralized Access Policy Enforcement
- Wire `resolveBrandAccessDecision(...)` into server bootstrap/app context
- Start enforcing blocked states based on brand control + billing state
- Add baseline blocked-state UI surfaces (no Stripe yet)

### Phase 4: Admin Backend (`admin.*`)
- Add `admin` TRPC routers using `platformAdminProcedure`
- Brand provisioning/memberships/invites/lifecycle mutations
- Write audit logs on all admin mutations using `platform_admin_audit_logs`

### Phase 5: Admin UI (`/admin`)
- Founder-only `/admin/brands`, `/admin/brands/new`, `/admin/brands/[brandId]`
- Provision demo brands, set statuses/plan, manage members/invites
- Use `brandId` in URLs

### Phase 6: Stripe Backend + Billing Sync
- Brand-level billing tables (Stripe customer/subscription sync + webhook events)
- Stripe Checkout for standard plans
- Stripe Invoice/Quote flow for custom enterprise
- Webhooks normalize Stripe events into local `billing_status`

### Phase 7: Billing UX + Full Product Gating
- Customer-facing activation/paywall flow
- Enforce access unlock/block transitions from webhook-updated billing state
- Admin + customer billing summaries stay consistent

### Phase 8: Cutover Cleanup + Regression Hardening
- Remove legacy self-serve brand creation assumptions
- Remove/deprecate manual invite acceptance paths
- Final backfills/cleanup, observability, tests, and founder runbook

## Important Implementation Reality Discovered (Use in Future Agent Sessions)

- Migration scripts are currently run from `/Users/rafmevis/avelero-v2/packages/db` (`bun db:generate`, `bun db:migrate`)
- `bun db:migrate` and `bun types:generate` may require local DB/Docker access permissions in sandboxed sessions
- `brand_control` backfill must be manually added to generated migration SQL (generator does not emit data backfills)

## Environment Variables Checklist (Current + Remaining)

### Required now (Phases 0-2 complete)
- `PLATFORM_ADMIN_EMAILS`
  - Required in both:
    - `/Users/rafmevis/avelero-v2/apps/api/.env`
    - `/Users/rafmevis/avelero-v2/apps/app/.env`
  - Format: comma-separated lowercase emails (example: `founder1@avelero.com,founder2@avelero.com`)
  - Purpose: platform admin allowlist for `platformAdminProcedure` and `/create-brand` route guard
- `NEXT_PUBLIC_SUPPORT_EMAIL` (optional but recommended)
  - Optional in:
    - `/Users/rafmevis/avelero-v2/apps/app/.env`
  - Purpose: renders `Contact founders` CTA on `/pending-access`
  - If unset, fallback copy is shown without a mailto button

### Remaining for upcoming billing phases (Phase 6+)
- The Stripe env names below are not wired yet in code, but should be reserved now to avoid naming drift:
- `STRIPE_SECRET_KEY` (API)
- `STRIPE_WEBHOOK_SECRET` (API)
- `STRIPE_PRICE_ID_STARTER` (API)
- `STRIPE_PRICE_ID_GROWTH` (API)
- `STRIPE_PRICE_ID_SCALE` (API)
- `STRIPE_ENTERPRISE_PRODUCT_ID` (API, optional if invoices/quotes use a dedicated product)
- `APP_URL` (API/app runtime, recommended explicit canonical URL for callback and webhook link generation)

## Recommended Next Session Target

- Phase 2A only: pre-auth invite-only signup enforcement (Supabase hook + OTP preflight + callback error normalization + `/invites` no-membership split)
</plan>
