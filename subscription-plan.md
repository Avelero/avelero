# Subscription Plan: Sales-Led Billing, Access Control & Admin System

## How This Plan Works

This document is the **master design document** for Avelero's subscription, billing, and access control system. It describes the target end state at a high level: how the sales cycle works, how brands move through lifecycle phases, how limits are enforced, how payments are handled, and how the admin panel operates.

This plan is broken into **large undertakings** (sections), each representing a major body of work. The undertakings are ordered by implementation priority, and each one depends on the ones before it.

### Sub-Plan Workflow

Before starting implementation of any undertaking, the implementing agent **must** produce three documents in a dedicated directory for that undertaking:

**1. `research.md`** — Current State Snapshot
A snapshot of the repository as it relates to the undertaking being implemented:
- The relevant file tree (files that will be read, modified, or created)
- An overview of how the affected systems currently work right now
- Key interfaces, types, and data flows that the undertaking will touch
- Any assumptions from previous undertakings that this one depends on

**2. `plan.md`** — Target State Specification
A snapshot of the repository *after* the undertaking is implemented:
- How the affected systems will work after implementation
- The target file tree (new files, modified files, deleted files)
- Detailed implementation steps broken into sub-tasks
- Interface contracts (function signatures, API shapes, type definitions)
- Migration requirements (if any)

**3. `test.md`** — Edge Cases & Acceptance Criteria
A comprehensive list of test scenarios for the undertaking:
- Description of each scenario
- Preconditions (user state, brand state, billing state, etc.)
- Steps to trigger the scenario
- Expected behavior/output
- Edge cases and failure modes

These three documents ensure that every undertaking is well-understood before code is written, that edge cases are considered upfront, and that there is a clear definition of "done."

---

## Sales Cycle Overview

This is the end-to-end flow that every customer goes through. All undertakings in this plan serve to enable this flow.

### Step 1: First Contact
A brand reaches out to us (inbound) or we reach out to them (outbound). We schedule a demo call.

### Step 2: Demo Preparation
Before the call, a founder provisions the brand's environment through the admin panel:
- Creates the brand (name, country, logo)
- Creates 2-3 mock products with sample supply chain data
- Designs their digital product passport using the theme editor, matching their webshop's visual identity (fonts, colors, corner radii, etc.)
- The brand is now in the **Demo** phase

### Step 3: Demo Call
We run the demo, showcasing their pre-configured brand environment with their branding and mock passports. We discuss their needs, catalog size, and answer questions.

### Step 4: Decision Period
After the call, the brand decides internally whether to proceed. During this time, their environment sits in the **Demo** phase. No user accounts have been created yet. Only the founder has access.

### Step 5: Invite & Onboarding
Once the brand confirms they want to proceed:
- The founder sends an invite from the admin panel to the brand's primary contact
- The contact receives an email with a token-based invite link
- They click the link, create their account (Google OAuth or OTP), and land in the pre-configured brand environment
- The brand transitions from **Demo** to **Trial** phase
- A **14-day grace period** begins

### Step 6: Grace Period (Trial)
During the 14-day trial:
- The brand has full access to all platform features
- They can connect their systems (Shopify, ERPs), import their catalog, customize their passport design, invite team members
- SKU limits are not plan-specific during this period; a generous universal cap applies (Scale-tier level: 10,000 + their onboarding allowance)
- A persistent UI element in the sidebar shows the remaining days and a CTA to select a plan
- They can select a plan and pay at any time during this period, which transitions them to **Active**

### Step 7: Plan Selection & Payment
- The brand clicks the plan selection CTA (or it becomes mandatory after grace period expires)
- They see all available plans: Starter, Growth, Scale, and Enterprise (contact us)
- For standard plans (Starter, Growth, Scale): they select a plan and are redirected to Stripe Checkout
- After successful payment, the brand transitions to **Active** phase
- For Enterprise: the founder pre-configures the plan, price, and SKU limit in the admin panel. The brand receives a Stripe Invoice instead of using Checkout. Payment of the invoice transitions them to **Active**.

### Step 8: Active Usage
- Plan-specific SKU limits are now enforced
- The brand operates normally within their plan's constraints
- Billing recurs monthly (or annually, if we add that option later)
- If payment fails, the brand enters **Past Due** state with degraded access

### Alternative: Brand Declines to Proceed
If at any point during the sales funnel the brand decides not to proceed:
- The founder sets the brand phase to **Cancelled** in the admin panel
- The brand environment is soft-deleted after 30 days (in case they change their mind)
- After 30 days, the environment is permanently deleted

### Alternative: Grace Period Expires Without Payment
If the 14-day grace period expires and no plan has been selected:
- The brand transitions to **Expired** phase
- Access is blocked; the user sees a paywall requiring plan selection
- The founder can extend the grace period from the admin panel if needed (e.g., procurement delays)
- If no action is taken within 30 days of expiry, the brand is set to **Cancelled**

---

## Pricing Model

### Plan Tiers

| Plan | Monthly Price | Annual Price | New SKUs/Year | Onboarding Allowance (Year 1) |
|---|---|---|---|---|
| Starter | €250 | €3,000 | 500 | 2,500 (5x) |
| Growth | €650 | €7,800 | 2,000 | 10,000 (5x) |
| Scale | €1,250 | €15,000 | 10,000 | 50,000 (5x) |
| Enterprise | Custom | Custom | Custom | Custom |

### How SKU Limits Work

- **Unit of measurement**: SKUs (each color/size combination = one SKU = one digital product passport)
- **Why SKUs, not products**: EU digital product passport regulations are expected to require per-SKU passports. Additionally, product-level counting creates a loophole where brands can merge SKUs into a single product to game the limit.
- **Annual limit**: Each plan allows a certain number of *new* SKUs to be created per year. This counter resets on the subscription anniversary date.
- **Onboarding allowance**: In the first year only, the limit is 5x the annual limit. This allows brands to onboard their existing catalog without being forced into a higher tier just for the initial upload. From year two onward, the standard annual limit applies.
- **All passports remain live forever**: Previously created passports are never affected by limits. The subscription fee covers hosting, availability, and compliance maintenance for every passport ever created. Limits only gate the creation of *new* SKUs.
- **Limit enforcement**: At 80% of the limit, a warning is shown. At 100%, new SKU creation is blocked with an upgrade prompt. Existing passports and all other platform features remain fully accessible.
- **Grace period limits**: During the 14-day trial, no plan-specific limits are enforced. A universal cap at the Scale-tier onboarding level (50,000 SKUs) prevents abuse.

### Enterprise Plan Details

Enterprise is not self-serve. It is managed entirely through the admin panel:
- The founder sets a custom SKU limit, custom monthly price, and billing mode (Stripe Invoice)
- The brand does not see the plan selector; their billing is handled via invoices
- Enterprise is appropriate for brands exceeding 10,000 new SKUs/year or requiring custom terms

---

## Brand Lifecycle Phases

Every brand on the platform exists in exactly one phase at any time. Phases are tracked on the brand record and drive access control, UI states, and billing behavior.

```
Demo --> Trial --> Active
  |        |         |
  |        |         +--> Past Due --> Suspended
  |        |
  |        +--> Expired --> Cancelled
  |
  +--> Cancelled
```

### Phase Definitions

| Phase | Description | Access Level | Triggered By |
|---|---|---|---|
| **Demo** | Brand environment provisioned by admin for demo purposes. No customer users yet. | Admin-only access | Admin creates brand |
| **Trial** | Customer has accepted invite and is in the 14-day grace period. | Full access, universal SKU cap | First customer user accepts invite |
| **Expired** | Grace period ended without plan selection/payment. | Blocked. Paywall shown. | 14-day timer expires |
| **Active** | Plan selected and payment successful. Normal operation. | Full access, plan-specific SKU limits | Stripe payment confirmed |
| **Past Due** | Payment failed on renewal. | Degraded: read-only access, no new SKU creation | Stripe payment failure webhook |
| **Suspended** | Manually suspended by admin (e.g., terms violation, dispute). | Fully blocked | Admin action |
| **Cancelled** | Brand has opted out or been abandoned. Soft-deleted. | Fully blocked | Admin action or 30 days after Expired |

### Phase Transitions

- **Demo --> Trial**: Automatically when the first non-admin user accepts an invite for this brand
- **Demo --> Cancelled**: Admin manually cancels (prospect declined)
- **Trial --> Active**: Stripe payment confirmation webhook received
- **Trial --> Expired**: 14-day grace period elapses without payment
- **Expired --> Active**: Late payment received (user selects plan and pays from paywall)
- **Expired --> Cancelled**: 30 days after expiry with no action, or admin manually cancels
- **Active --> Past Due**: Stripe payment failure webhook
- **Past Due --> Active**: Stripe payment success webhook (retry or manual payment)
- **Past Due --> Suspended**: Admin intervention or prolonged non-payment (configurable)
- **Active --> Suspended**: Admin manually suspends
- **Suspended --> Active**: Admin manually reactivates
- **Any --> Cancelled**: Admin manually cancels

### Admin Overrides

The admin panel allows founders to override certain phase behaviors:
- **Extend grace period**: Set a custom trial end date (for procurement delays)
- **Grant temporary access**: Override access block for a brand in Expired or Past Due state
- **Custom SKU limit**: Set a per-brand SKU limit that overrides the plan default
- **Adjust onboarding allowance**: Increase the year-one allowance for brands with large catalogs

---

## Undertaking 1: Database Layer (Brand Lifecycle & Billing Schema)

### Priority: First
### Depends on: Nothing (foundational)

### Progress Update (2026-02-28)

Status: **Implemented in code, migration generated, validated locally; pending merge/deploy to production.**

- Added new schema tables in `packages/db/src/schema/`:
  - `brand_lifecycle`
  - `brand_plan`
  - `brand_billing`
  - `brand_billing_events`
  - `stripe_webhook_events`
  - `platform_admin_audit_logs`
- Exported all new tables from `packages/db/src/schema/index.ts`.
- Updated `createBrand(...)` to seed `brand_lifecycle`, `brand_plan`, and `brand_billing` in the same transaction as brand/theme/catalog/member/user setup.
- Added idempotent backfill script: `packages/db/src/scripts/backfill-brand-subscription-foundations.ts`.
- Added package command: `db:backfill:subscription`.
- Generated migration: `apps/api/supabase/migrations/20260228155219_naive_callisto.sql`.
- Regenerated Supabase DB types.
- Added integration tests for seeding, constraints, uniqueness, cascade behavior, and backfill idempotency.
- Validation completed successfully:
  - `bun db:migrate`
  - `bun run db:backfill:subscription`
  - `bun types:generate`
  - `bun typecheck`
  - `bun lint`
  - `bun run test` (isolated disposable DB flow)

#### Backfill Decision and Environment Notes

- Local environment has been reset, so local backfill is currently a no-op.
- Production backfill mode remains **manual one-time**, idempotent, run after migration deploy:
  - `cd /Users/rafmevis/avelero-v2/packages/db`
  - `DATABASE_URL="<production_database_url>" bun run db:backfill:subscription`

#### Production Preflight Check (2026-02-28)

- Ran read-only `psql` checks against the remote DB URL in `packages/db/.env`.
- Migration history currently tops at `20260225201723`.
- Confirmed these tables are currently absent (no naming collision):
  - `platform_admin_audit_logs`
  - `brand_lifecycle`
  - `brand_plan`
  - `brand_billing`
  - `brand_billing_events`
  - `stripe_webhook_events`
  - `brand_control`
- Confirmed dependency function exists: `public.is_brand_member(uuid)`.
- Preflight conclusion: no table-exists conflict expected for Undertaking 1 migration on that target database.

This undertaking establishes the data model that all other undertakings build on. Without these tables and fields, nothing else can be implemented.

### What Existed Before Undertaking 1

Before this undertaking, nothing related to billing, lifecycle phases, or subscription management existed in the schema. The database had the core `brands`, `users`, `brand_members`, and `brand_invites` tables, along with product/passport tables, but no concept of brand phases, SKU limits, payment tracking, or admin controls.

There was also no `platform_admin_audit_logs` table, no platform admin middleware, and no access policy engine. This undertaking started as greenfield.

### What Needs to Be Created

Three new tables, each 1:1 with `brands`, that separate lifecycle, plan/limits, and billing into distinct concerns. This separation is intentional: each table is read and written by different parts of the system at different times, and keeping them separate avoids coupling unrelated state changes.

#### Table 1: `brand_lifecycle` (1:1 with `brands`)

Tracks the brand's current phase and lifecycle timestamps. This is the primary table read by the access policy engine to determine what a brand can and cannot do.

- `id`: Primary key
- `brand_id`: Foreign key to `brands` (unique, 1:1)
- `phase`: The current brand phase (demo | trial | expired | active | past_due | suspended | cancelled)
- `phase_changed_at`: Timestamp of the last phase transition
- `trial_started_at`: When the trial/grace period began (null if still in Demo)
- `trial_ends_at`: When the trial/grace period expires (null if still in Demo, can be extended by admin)
- `cancelled_at`: When the brand was cancelled (null if not cancelled)
- `hard_delete_after`: When the brand should be permanently deleted (30 days after cancellation)
- `created_at`, `updated_at`: Standard timestamps

**Who reads this**: Access policy engine, dashboard layout, admin panel lifecycle section.
**Who writes this**: Invite acceptance (Demo --> Trial), trial expiry job, Stripe webhooks (Trial --> Active, Active --> Past Due), admin actions (suspend, cancel, extend trial).

#### Table 2: `brand_plan` (1:1 with `brands`)

Tracks the brand's selected plan, SKU limits, and usage counters. This is the primary table read by the SKU enforcement logic.

- `id`: Primary key
- `brand_id`: Foreign key to `brands` (unique, 1:1)
- `plan_type`: The selected plan (starter | growth | scale | enterprise | null)
- `plan_selected_at`: When the plan was selected (null if not yet selected)
- `sku_annual_limit`: The plan's annual new SKU limit (500, 2000, 10000, or custom for enterprise)
- `sku_onboarding_limit`: The year-one onboarding allowance (5x annual limit, or custom)
- `sku_limit_override`: Admin-set override that supersedes plan limits (nullable; when set, this is used instead of `sku_annual_limit`)
- `sku_year_start`: The date the current annual SKU counting period started (subscription anniversary)
- `skus_created_this_year`: Counter of new SKUs created in the current annual period (resets on anniversary)
- `skus_created_onboarding`: Counter of SKUs created during the onboarding year (first year only)
- `max_seats`: Maximum number of members allowed (nullable = unlimited for now)
- `created_at`, `updated_at`: Standard timestamps

**Who reads this**: SKU enforcement logic (product creation endpoints), billing UX (usage display), admin panel plan section.
**Who writes this**: Plan selection (sets plan_type and limits), product creation (increments counters), annual reset job (resets yearly counter), admin actions (override limits).

#### Table 3: `brand_billing` (1:1 with `brands`)

Tracks the Stripe integration state and billing mechanics. This is the primary table read and written by the Stripe integration.

- `id`: Primary key
- `brand_id`: Foreign key to `brands` (unique, 1:1)
- `billing_mode`: How payment is handled (stripe_checkout | stripe_invoice | null)
- `stripe_customer_id`: The Stripe customer ID linked to this brand (nullable)
- `stripe_subscription_id`: The active Stripe subscription ID (nullable)
- `plan_currency`: Currency for billing (default EUR)
- `custom_monthly_price_cents`: For enterprise plans with custom pricing (nullable)
- `billing_access_override`: Admin override for access (none | temporary_allow | temporary_block)
- `billing_override_expires_at`: When the override expires (nullable)
- `created_at`, `updated_at`: Standard timestamps

**Who reads this**: Stripe integration (webhook handler), access policy engine (for billing overrides), admin panel billing section, customer billing settings page.
**Who writes this**: Stripe Checkout completion, Stripe webhooks, admin actions (create invoice, set override, configure enterprise pricing).

#### Additional Tables

**`brand_billing_events`**: Log of all billing-related events for a brand (payments, failures, refunds, plan changes). Used for admin visibility and debugging.
- `id`, `brand_id`, `event_type`, `stripe_event_id`, `payload`, `created_at`

**`stripe_webhook_events`**: Idempotency table for Stripe webhook processing.
- `id`, `stripe_event_id`, `event_type`, `processed_at`, `created_at`

**`platform_admin_audit_logs`**: New table. Audit trail for all admin actions.
- `id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `payload`, `created_at`

### Table Creation Strategy

When a new brand is created (via the admin panel), all three 1:1 tables (`brand_lifecycle`, `brand_plan`, `brand_billing`) should be created in the same transaction as the brand itself, with sensible defaults:
- `brand_lifecycle`: phase = demo, all timestamps null
- `brand_plan`: plan_type = null, all limits = null, all counters = 0
- `brand_billing`: billing_mode = null, all Stripe fields null, billing_access_override = none

This mirrors how the existing `createBrand()` function already seeds related tables (theme, catalog) in the same transaction.

### Migration Notes

- All tables in this undertaking are new. No existing tables need modification (except adding foreign keys from the new tables to `brands`).
- After creating the schema files in `packages/db/src/schema/`, run `bun db:generate` to generate the migration, then `bun db:migrate` to apply it, then `cd packages/supabase && bun types:generate` to regenerate types.
- Any existing brands in the database at the time of migration should be backfilled with sensible defaults (phase = demo, no plan selected).

### Key Decisions

- **Three separate tables instead of one**: `brand_lifecycle`, `brand_plan`, and `brand_billing` each hold a distinct concern. The access policy engine reads lifecycle + billing overrides. The SKU enforcement reads plan. The Stripe integration reads/writes billing. This avoids coupling and makes each part of the system narrower and more focused.
- **Single `phase` field**: Use a single `phase` enum rather than multiple separate status fields (like separate qualification, operational, and billing statuses). A single phase field makes the brand's state unambiguous at all times.
- **SKU counting**: Count at creation time, not retroactively. When a new product variant (SKU) is created, increment the counter. This is simple, deterministic, and doesn't require periodic recalculation.
- **Onboarding year detection**: The onboarding year is simply "from `trial_started_at` to `trial_started_at + 1 year`". After that, the annual limit applies, resetting on each anniversary of `sku_year_start`.

---

## Undertaking 2: Invite-Only Signup & Access Flow

### Priority: Second
### Depends on: Undertaking 1 (brand phases must exist)

This undertaking locks down the signup flow so that only invited users can create accounts and access the platform. It also handles the phase transition from Demo to Trial when a user accepts their invite.

### What Exists Today

The current system allows anyone to sign up and create a brand:
- Auth is handled by Supabase Auth (Google OAuth and OTP)
- OAuth callback is in `apps/app/src/app/api/auth/callback/route.ts`
- OTP verification is in `apps/app/src/actions/auth/verify-otp-action.ts`
- Auth redirect logic is in `apps/app/src/lib/auth-redirect.ts`
- After signup, users without a brand are redirected to `/create-brand`
- A basic invite system exists: brand owners can send invites via `brand.invites.send` TRPC endpoint
- Invite emails are sent via Trigger.dev background jobs using React Email templates
- Invite acceptance creates a `brand_members` row
- The `brand_invites` table tracks pending invites with token hashes, expiry dates, and email matching

The invite system works but is currently a secondary path. The primary path is self-serve signup and brand creation. This undertaking flips that: invites become the only path, and self-serve signup/brand creation is disabled.

### What Needs to Be Built

**Signup enforcement:**
- Public signup must be completely disabled. If someone tries to sign up without an invite link, they are blocked before an auth account is even created.
- Implement a `before_user_created` Supabase auth hook that rejects non-invited emails. This is a PostgreSQL function that Supabase calls before creating a new auth user.
- OTP preflight check: before sending a verification code, check if the email has a pending invite or existing account. If neither, block the attempt with a clear error message.
- Google OAuth: the Supabase hook rejects new account creation for non-invited emails. Map the rejection to a clear login error (this was a difficult thing to get right previously, so we shuld spend careful time planning this).

**Invite acceptance and phase transition:**
- When the first non-admin user accepts an invite for a brand that is in the **Demo** phase, automatically transition the brand to **Trial** phase
- Set `trial_started_at` to the current timestamp
- Set `trial_ends_at` to `trial_started_at + 14 days`
- This is the trigger for the grace period countdown

**Invite sources:**
- **Admin panel**: Founders can send invites to any email for any brand they manage. This is the primary onboarding path.
- **Brand members**: Brand owners/admins can invite additional team members through the existing in-app invite flow. This allows brands to self-serve on adding their own team members.
- Both sources use the same underlying invite system (token-based links, same acceptance flow)

**Brand member invites (team expansion):**
- Any brand owner can invite additional users to their brand workspace
- Invited users follow the same flow: receive token email, click link, create account (if new) or sign in (if existing), land in the brand
- Limit on the number of invites (for now; `max_seats` field exists for enforcement, default is 'null' for now until future enforcement)
- The inviting user must have the `owner` role on the brand

**Admin self-access (hidden `avelero` role):**
- Founders can add themselves to any brand directly from the admin panel (no invite required)
- Founders can remove themselves from any brand directly from the admin panel
- This is used for demo preparation, support, and troubleshooting
- When a founder uses "Add Self to Brand" from the admin panel, they are added with the special `avelero` role (not `owner` or `member`)
- The `avelero` role has the same permissions as `owner` (full access to everything in the brand) but is **invisible to customers**:
  - Members with the `avelero` role are hidden from the customer-facing members list and all other customer-visible UI that shows brand members
  - Members with the `avelero` role are excluded from member counts (both in the customer app and in the admin panel's brand list table)
  - Members with the `avelero` role are only visible in the admin panel's member management section for that brand
- This is distinct from normal brand creation: when a founder creates a brand via the admin panel's "Create Brand" flow, they are added as a normal `owner`, not `avelero`. The `avelero` role is exclusively for the "Add Self to Brand" admin action.
- The `brand_members` table's `role` column must be updated to support three values: `owner`, `member`, `avelero`

**Post-signup routing:**
- User with brand membership --> brand dashboard (normal flow)
- User without brand membership but with pending invites --> `/invites` page
- User without brand membership and no pending invites --> `/pending-access` page (shouldn't happen in normal flow, but safety net)
- No user should ever be routed to `/create-brand` (page components will be re-used in the future for the admin dashboard)

### Key Decisions

- **No self-serve brand creation**: Users cannot create brands. Period. Only founders can create brands through the admin panel.
- **Unlimited seats (for now)**: We don't enforce seat limits in this version. The `max_seats` field exists for future use, make sure the invite flow checks for max_seats, but since it's already 'null' it's unlimited. All plans currently allow unlimited team members.
- **Invite expiry**: Invites expire after 7 days. The founder can re-send from the admin panel.

---

## Undertaking 3: Access Policy Engine

### Priority: Third
### Depends on: Undertaking 1 (phases), Undertaking 2 (invite flow triggers phase transitions)

This undertaking creates the centralized logic that determines what a user can and cannot do based on their brand's current phase, billing state, and SKU usage.

### What Exists Today

Nothing. There is no access policy engine, no centralized access decision function, and no enforcement of brand lifecycle states anywhere in the codebase. Access control currently only checks whether a user has a brand membership (via `brandRequiredProcedure` in the TRPC proxy), but does not consider billing state, trial status, or any lifecycle phase.

### What Needs to Be Built

**Central access decision function:**

A single server-side function that takes the brand's current state and returns an access decision. This function is the **sole source of truth** for access control. No other part of the codebase should make ad-hoc access decisions.

Input (from `brand_lifecycle` + `brand_billing`):
- Brand phase (from `brand_lifecycle`)
- Trial end date (from `brand_lifecycle`, if applicable)
- Billing access override (from `brand_billing`, if applicable)
- Override expiry (from `brand_billing`, if applicable)

Note: This function is only called when a user already has a brand context (i.e., they are a member of a brand). The "no membership" case is handled upstream in the auth redirect logic, before the access engine is ever invoked.

Output (one of):
- `full_access` — Brand is Active with a paid subscription. All features available.
- `trial_active` — Brand is in Trial with time remaining. Full access, but show trial banner with countdown.
- `payment_required` — Trial has expired or brand otherwise needs payment. Blocked. Show paywall with plan selector.
- `past_due` — Payment failed on renewal. Read-only access, no new SKU creation. Show recovery UI.
- `suspended` — Admin-suspended. Fully blocked. Show contact support message.
- `cancelled` — Brand is cancelled. Fully blocked. Show final message.

**SKU limit check function:**

A separate function (or part of the access engine) that determines whether a brand can create new SKUs:

Input:
- Brand plan type
- SKU annual limit (or override)
- SKU onboarding limit
- SKUs created this year
- SKUs created during onboarding
- Whether we're still in the onboarding year

Output:
- `allowed` — Under limit, can create
- `warning` — At 80%+ of limit, can create but show warning
- `blocked` — At limit, cannot create, show upgrade prompt

**Enforcement integration points:**

The access decision must be checked at these points:
- **Dashboard layout**: On every page load, check the brand's access decision. If blocked, show the appropriate screen (paywall, past-due recovery, suspended message) instead of the normal dashboard.
- **API mutations**: Any TRPC mutation that creates or modifies brand data should check access. If the brand is in a blocked state, reject the mutation with a clear error.
- **SKU creation**: Specifically, the product/variant creation endpoints must check the SKU limit before allowing creation.
- **Composite bootstrap**: The `composite.initDashboard` endpoint (or its replacement) should include the access decision and SKU usage stats in its response, so the frontend can render the correct UI without extra round-trips.

### Key Decisions

- **Server-side enforcement only**: The frontend shows appropriate UI based on the access decision, but enforcement happens on the server. A determined user cannot bypass limits by manipulating the frontend.
- **Read-only for Past Due**: Brands with failed payments can still view their data but cannot create new SKUs or modify passports. This prevents data loss while incentivizing payment.
- **No feature-level gating between plans**: All plans have the same features. The only difference between plans is the SKU limit. This keeps enforcement simple and avoids a complex permissions matrix.

---

## Undertaking 4: Admin Panel (Separate Next.js Application)

### Priority: Fourth
### Depends on: Undertaking 1 (database schema), Undertaking 2 (invite system), Undertaking 3 (access decisions for display)

This undertaking builds the founder-facing admin panel as a **separate Next.js application** deployed independently on Vercel, connected to the same Supabase database.

### Why a Separate App

- Clean separation between customer-facing app and internal tooling
- Independent deployment (admin changes don't risk breaking the customer app)
- Simpler auth model (just whitelist founder emails, no complex role system)
- Can have its own UI patterns, design system, and development velocity

### Tech Stack

- Next.js (same version as the main app for consistency)
- Connected to the same Supabase instance (same database, same auth)
- TRPC or direct Supabase queries (TBD during sub-plan, but likely direct queries for simplicity since this is an internal tool)
- Deployed on Vercel under a separate domain (e.g., `admin.avelero.com`)
- Auth: Supabase Auth (same Google OAuth), with server-side check that the authenticated email is in the admin allowlist

### Pages

**Page 1: Brand List (Home/Dashboard)**

The landing page after login. Shows a table of all brands on the platform with key information at a glance:

| Column | Description |
|---|---|
| Brand Name | Brand name (clickable, links to brand detail) |
| Phase | Current lifecycle phase (color-coded badge) |
| Plan | Selected plan type, or "None" if not yet selected |
| SKU Usage | Current year SKUs created / limit |
| Trial Ends | Grace period end date (if in Trial phase) |
| Members | Number of active members (excludes `avelero` role members) |
| Created | When the brand was created |

Features:
- Search by brand name
- Filter by phase (Demo, Trial, Active, Expired, Past Due, Suspended, Cancelled)
- Sort by any column
- Quick-action buttons: "Create Brand" prominently placed

**Page 2: Create Brand**

A simple multi-step form for provisioning a new brand:

Step 1: Brand Identity (re-use the brand create form from /create-brand page)
- Brand name (required)
- Country (required)

That's it. The brand is created in **Demo** phase with default settings. The founder can then access the brand through the main app to set up mock products and design the passport.

After creation, redirect to the brand detail page where the founder can manage settings and send invites.

**Page 3: Brand Detail / Management**

This is the most complex page. It shows everything about a brand and allows the founder to manage it. Organized into sections:

**Section: Overview**
- Brand name, logo, country, slug
- Current phase (with color-coded badge and phase transition timestamp)
- Contextual quick actions (change based on current phase):

| Phase | Quick Actions |
|---|---|
| Demo | Send Invite, Add/Remove Self |
| Trial | Extend Trial, Add/Remove Self |
| Expired | Extend Trial, Grant Temporary Access |
| Active | Add/Remove Self |
| Past Due | Grant Temporary Access, Suspend |
| Suspended | Reactivate |
| Cancelled | (no actions) |

**Section: Lifecycle Management**
- Current phase display with transition history
- Phase override actions:
  - "Extend Trial" button (set custom `trial_ends_at`)
  - "Suspend Brand" / "Reactivate Brand" toggle
  - "Cancel Brand" button (with confirmation)
  - "Grant Temporary Access" (set `billing_access_override` with expiry date)

**Section: Plan & Limits**
- Current plan type (or "None")
- For Enterprise: editable fields for custom SKU limit and custom monthly price
- SKU usage stats:
  - Onboarding SKUs created / onboarding allowance
  - Current year SKUs created / annual limit
  - Whether still in onboarding year
- Override controls:
  - Custom SKU limit override (overrides plan default)
  - Custom onboarding allowance (if they need more)

**Section: Billing**
- Stripe customer ID (linked or not)
- Current subscription status
- Next payment date
- Payment history (last 5-10 events from `brand_billing_events`)
- Actions:
  - "Create Checkout Session" (generates a Stripe Checkout link for the brand to pay)
  - "Create Invoice" (for Enterprise; generates a Stripe Invoice)
  - "Open Stripe Dashboard" (direct link to this customer in Stripe)

**Section: Members**
- Table of current brand members (email, role, joined date)
- This table shows ALL members including those with the `avelero` role (unlike the customer-facing app, which hides `avelero` members)
- `avelero` role members are visually distinguished (e.g., subtle badge or different row styling) so the admin can tell them apart
- "Add Self" / "Remove Self" buttons (adds/removes the founder with the `avelero` role)
- "Remove Member" action per row

**Section: Invites**
- Table of pending invites (email, role, sent date, expires date)
- "Send Invite" form (email + role)
- "Revoke" action per row

**Section: Audit Log**
- Chronological feed of all admin actions taken on this brand
- Shows: action, actor, timestamp, details
- Read from `platform_admin_audit_logs` filtered by brand

### Admin Workflows

Here are the specific workflows that the admin panel must support end-to-end:

**Workflow: Provision a Demo Brand**
1. Click "Create Brand" on the brand list
2. Enter name and country
3. Brand is created in Demo phase
4. Founder clicks "Add Self to Brand" to get access
5. Founder opens the brand in the main app and sets up mock products + passport design
6. Demo is ready for the sales call

**Workflow: Onboard a Customer After Sales Call**
1. Navigate to the brand's detail page
2. Click "Send Invite" and enter the customer's email
3. Customer receives invite, signs up, accepts
4. Brand automatically transitions to Trial (14-day grace period starts)
5. Founder optionally removes themselves from the brand

**Workflow: Handle Enterprise Customer**
1. On the brand detail page, set plan type to "Enterprise"
2. Enter custom SKU limit and custom monthly price
3. Click "Create Invoice" to generate a Stripe Invoice
4. Invoice is sent to the brand's billing contact
5. When paid, webhook transitions brand to Active

**Workflow: Extend Grace Period**
1. Navigate to brand detail page (brand is in Trial or Expired phase)
2. Click "Extend Trial"
3. Enter new end date
4. If brand was Expired, transition back to Trial with new end date

**Workflow: Support a Customer**
1. Navigate to brand detail page
2. Click "Add Self to Brand"
3. Open the brand in the main app
4. Troubleshoot or fix issues
5. Return to admin panel, click "Remove Self from Brand"

**Workflow: Handle Non-Payment**
1. Brand is in Past Due state (visible in brand list, filtered by phase)
2. Review payment history in the billing section
3. Options: contact customer, grant temporary access override, or suspend

---

## Undertaking 5: Stripe Billing Integration

### Priority: Fifth
### Depends on: Undertaking 1 (billing fields in DB), Undertaking 3 (access policy updates on payment), Undertaking 4 (admin panel for Enterprise invoicing)

This undertaking integrates Stripe for all payment processing: standard plan Checkout, Enterprise invoicing, subscription management, and webhook processing.

### Stripe Architecture

**Brand-level billing**: Billing is attached to the brand, not the user. Each brand has one Stripe Customer and one Stripe Subscription (or Invoice for Enterprise).

**Two billing modes:**
- `stripe_checkout`: For Starter, Growth, and Scale plans. Uses Stripe Checkout Sessions. Creates a Subscription with monthly recurring billing.
- `stripe_invoice`: For Enterprise plans. Uses Stripe Invoices with custom line items. Can be one-time or recurring depending on the contract.

### Stripe Resources to Create

**Products and Prices (created once in Stripe Dashboard):**
- Product: "Avelero Starter Plan" with Price: €250/month
- Product: "Avelero Growth Plan" with Price: €650/month
- Product: "Avelero Scale Plan" with Price: €1,250/month
- Enterprise uses custom Invoices, not pre-defined Products/Prices

**Per-Brand Resources (created programmatically):**
- Stripe Customer: Created when a brand first enters the billing flow. Linked to brand via `stripe_customer_id`.
- Stripe Checkout Session: Created when a brand selects a standard plan. Includes brand metadata (`brand_id`, `plan_type`).
- Stripe Subscription: Created automatically by Checkout completion. Linked via `stripe_subscription_id`.
- Stripe Invoice: Created by admin for Enterprise brands with custom line items.

### Webhook Events to Handle

| Event | Action |
|---|---|
| `checkout.session.completed` | Link Stripe Customer and Subscription to brand. Set phase to Active. Set plan type and limits. |
| `invoice.paid` | For Enterprise: set phase to Active. For standard: confirm renewal. |
| `invoice.payment_failed` | Set phase to Past Due. |
| `customer.subscription.updated` | Sync plan changes (upgrades/downgrades). |
| `customer.subscription.deleted` | Set phase to Cancelled (or Expired, depending on reason). |

### Webhook Processing Rules

- **Idempotency**: Every webhook event is logged in `stripe_webhook_events` with its `stripe_event_id`. Duplicate events are ignored.
- **Metadata**: Every Checkout Session and Invoice includes `brand_id` in metadata so webhooks can be routed to the correct brand.
- **Signature verification**: All webhooks are verified using the Stripe webhook signing secret.

### Customer-Facing Billing Endpoints

- `brand.billing.createCheckoutSession`: Creates a Stripe Checkout Session for the authenticated user's brand. Requires that the brand is in Trial or Expired phase. Returns the Checkout URL.
- `brand.billing.getStatus`: Returns the brand's current billing state (plan, next payment date, subscription status).
- `brand.billing.getPortalUrl`: Returns a Stripe Customer Portal URL for managing payment methods and viewing invoices.

### Admin Billing Endpoints

- `admin.billing.createCheckoutLink`: Creates a Checkout Session for a specific brand (used to share a payment link).
- `admin.billing.createInvoice`: Creates a Stripe Invoice for an Enterprise brand with custom amount.
- `admin.billing.getBrandBilling`: Returns full billing details for a brand (Stripe Customer, Subscription, recent events).

### Environment Variables

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_GROWTH=price_...
STRIPE_PRICE_ID_SCALE=price_...
APP_URL=https://app.avelero.com  (for Checkout success/cancel redirect URLs)
```

### Key Decisions

- **Monthly billing only (for now)**: Annual billing can be added later by creating annual Price objects in Stripe and offering a toggle in the plan selector. Not in scope for this version.
- **No proration on plan changes**: If a brand upgrades mid-cycle, we handle it via Stripe's built-in proration. No custom logic needed.
- **No self-serve downgrade**: Brands can upgrade self-serve but must contact us to downgrade. This prevents brands from upgrading temporarily to import a large catalog and then immediately downgrading.
- **No free tier**: There is no free plan. All brands must be on a paid plan after their grace period.

---

## Undertaking 6: Customer-Facing Billing UX (Paywall, Plan Selection, Billing Settings)

### Priority: Sixth
### Depends on: Undertaking 3 (access policy for gating), Undertaking 5 (Stripe integration for payment)

This undertaking builds all the customer-facing UI related to billing: the plan selector, the paywall for blocked brands, the trial countdown, and the billing settings page.

### UI Components

**Trial Banner (Sidebar)**
- Shown when brand phase is Trial
- Persistent element in the bottom of the sidebar
- Shows: "X days remaining" with a progress bar or countdown
- CTA: "Choose a plan" that opens the plan selection page
- Becomes more prominent as the deadline approaches (e.g., changes color in the last 3 days)

**Paywall Screen**
- Shown as a full-page overlay when brand phase is Expired (grace period ended without payment)
- Replaces the normal dashboard content
- Message: "Your trial has ended. Select a plan to continue using Avelero."
- Shows the plan selector (see below)
- No way to dismiss or bypass

**Plan Selector**
- Shows all four plan options side by side:
  - Starter (€250/month) — up to 500 new SKUs/year
  - Growth (€650/month) — up to 2,000 new SKUs/year
  - Scale (€1,250/month) — up to 10,000 new SKUs/year
  - Enterprise — "Contact us" (no self-serve purchase)
- Each plan card shows: price, SKU limit, and a "Select" button
- Selecting a standard plan redirects to Stripe Checkout
- Selecting Enterprise shows a contact form or email link
- Accessible both from the trial banner CTA and from billing settings

**Past Due Banner**
- Shown when brand phase is Past Due
- Non-dismissible banner at the top of every page
- Message: "Your payment failed. Please update your payment method to continue."
- CTA: "Manage billing" that opens the Stripe Customer Portal
- During Past Due, the brand has read-only access (can view everything but cannot create new SKUs or edit passports)

**Suspended Screen**
- Shown as a full-page overlay when brand phase is Suspended
- Message: "Your account has been suspended. Please contact support."
- Contact information or support email
- No way to dismiss or bypass

**Billing Settings Page (`/settings/billing`)**
- Accessible from the brand settings navigation
- Shows:
  - Current plan name and price
  - SKU usage: "X of Y new SKUs used this year" with progress bar
  - If in onboarding year: "X of Y onboarding SKUs used" with separate progress bar
  - Next billing date
  - Payment method summary (last 4 digits of card)
  - "Manage billing" button (opens Stripe Customer Portal for payment method changes, invoice history)
  - "Upgrade plan" button (opens plan selector)

### SKU Limit Warning UI

When a brand approaches their SKU limit:
- **At 80%**: Yellow warning banner on the products page: "You've used X of Y new SKUs for this year. Consider upgrading."
- **At 100%**: The "Create Product" / "Add Variant" buttons are disabled. A message explains: "You've reached your plan's SKU limit for this year. Upgrade your plan to add more products."
- The upgrade prompt links directly to the plan selector

### Key Decisions

- **No "current plan" highlight in plan selector during trial**: During the trial, no plan is selected yet, so all plans are shown equally. After payment, the current plan is highlighted and the upgrade button is shown on higher tiers.
- **Enterprise is always "Contact us"**: Enterprise customers never self-serve. The plan selector shows Enterprise as an option but with a contact CTA, not a purchase button.
- **Stripe Customer Portal for billing management**: We don't build custom UI for updating payment methods or viewing invoices. Stripe's hosted Customer Portal handles this. Keeps scope small.

---

## Undertaking 7: SKU Limit Enforcement

### Priority: Seventh
### Depends on: Undertaking 1 (SKU counters in DB), Undertaking 3 (access policy), Undertaking 5 (plan selection determines limits)

This undertaking implements the actual enforcement of SKU limits at the API level and the corresponding UI feedback.

### Where Enforcement Happens

**Server-side (TRPC mutations):**
Every API endpoint that creates a new SKU (product variant) must check the limit before allowing creation. This includes:
- Single product creation (manual form)
- Bulk product import (CSV, Excel)
- Product creation via integrations (Shopify sync, API)
- Variant addition to existing products

The check logic:
1. Load the brand's SKU counters and limits
2. Determine if we're in the onboarding year (current date < `trial_started_at` + 1 year)
3. If onboarding year: check `skus_created_onboarding` against `sku_onboarding_limit`
4. Check `skus_created_this_year` against `sku_annual_limit` (or `sku_limit_override` if set)
5. If either limit is exceeded: reject the creation with a clear error code
6. If within limits: allow creation and increment the appropriate counter(s)

**Important**: A single creation request might create multiple SKUs (e.g., a product with 5 colors x 4 sizes = 20 SKUs). The limit check must account for the total number of SKUs being created in the request, not just check "is the current count under the limit."

### Counter Management

- **Increment on creation**: When SKUs are created, increment `skus_created_this_year` (and `skus_created_onboarding` if in onboarding year)
- **No decrement on deletion**: If a brand deletes a product/variant, the counter does NOT decrease. This prevents gaming where brands delete and re-create to reset their count. (Passports should remain live anyway for compliance, so deletion should be rare.)
- **Annual reset**: When the current date passes `sku_year_start + 1 year`, reset `skus_created_this_year` to 0 and update `sku_year_start` to the new anniversary date. This can be done lazily (check on next SKU creation) or via a scheduled job.
- **Onboarding year end**: After `trial_started_at + 1 year`, the onboarding allowance no longer applies. Only the annual limit is checked from that point forward.

### Grace Period Limits

During the 14-day trial (brand phase = Trial):
- No plan has been selected, so no plan-specific limit exists
- Apply a universal cap at the Scale-tier onboarding level (50,000 SKUs) to prevent abuse
- This is generous enough that no legitimate brand will hit it during a 14-day period

After plan selection (regardless of whether still in trial or not):
- Plan-specific limits apply immediately
- If the brand created more SKUs during the trial than their selected plan's onboarding allowance, they are NOT penalized (those SKUs remain). However, they cannot create new SKUs until they either upgrade or until their annual period resets. In practice this is unlikely because the trial is only 14 days.

### Key Decisions

- **No per-SKU overage billing**: When a brand hits their limit, they're blocked. They must upgrade. We don't charge per additional SKU. This keeps billing simple and predictable.
- **Counters are non-decreasing within a period**: Deleting SKUs doesn't give back limit. This prevents gaming.
- **Lazy annual reset**: The counter resets when checked, not via a background job. Simpler to implement, same end result.
- **Bulk creation is all-or-nothing**: If a brand tries to import 100 SKUs but only has room for 80, the entire import is rejected with a message: "This import would create 100 new SKUs, but you only have 80 remaining in your plan. Upgrade or reduce the import size."

---

## Undertaking 8: Cleanup, Migration & Hardening

### Priority: Last
### Depends on: All previous undertakings

This undertaking removes legacy code, backfills data for existing brands, and hardens the system for production use.

### Legacy Code Removal

- Remove all self-serve brand creation code paths (the `/create-brand` page for non-admins, the "Create Brand" button in brand selector, etc.)
- Remove or repurpose the `/pending-access` page routing for cases now handled by the paywall
- Audit all redirect logic to ensure no dead paths remain (e.g., no-brand users should never land on `/create-brand`)
- Remove any unused TRPC endpoints that were part of the old self-serve flow

### Data Migration

- Backfill all existing brands with appropriate phases:
  - Brands with active users and usage --> `active` phase
  - Brands created by admin with no customer users --> `demo` phase
  - Any other state --> assess case by case
- Initialize SKU counters for existing brands based on current product counts
- Set `sku_year_start` for existing brands to their creation date (or current date)

### Operational Hardening

- **Monitoring**: Alerts for webhook processing failures, phase transition errors, SKU counter inconsistencies
- **Logging**: Structured logs for all phase transitions, billing events, and admin actions
- **Error handling**: Graceful degradation if Stripe is unavailable (brand stays in current phase, doesn't get locked out due to webhook delay)

### Founder Runbook

Create a reference document for day-to-day operations:
- How to provision a demo brand
- How to prepare for a sales demo
- How to onboard a customer after a successful demo
- How to handle an Enterprise deal
- How to extend a grace period
- How to handle payment failures
- How to suspend/reactivate a brand
- How to add/remove yourself from a customer brand for support
- How to check SKU usage and adjust limits

---

## Cross-Cutting Concerns

### Email Notifications

The following emails need to be sent as part of the subscription lifecycle. These use the existing email infrastructure (React Email + Resend via Trigger.dev background jobs):

| Trigger | Recipient | Email Content |
|---|---|---|
| Invite sent | Invited user | Token-based invite link |
| Trial starts | Brand owner | Welcome email, 14-day timeline, link to plan selection |
| Trial day 10 | Brand owner | Reminder: 4 days remaining, CTA to select plan |
| Trial day 13 | Brand owner | Urgent: 1 day remaining, CTA to select plan |
| Trial expired | Brand owner | Trial ended, must select plan to continue |
| Payment successful | Brand owner | Confirmation, plan details, next billing date |
| Payment failed | Brand owner | Action required, link to update payment method |
| Plan upgraded | Brand owner | Confirmation of new plan, new limits |
| SKU limit at 80% | Brand owner | Approaching limit, consider upgrading |
| SKU limit reached | Brand owner | Limit reached, must upgrade to create more |

### Scheduled Jobs

| Job | Frequency | Action |
|---|---|---|
| Trial expiry check | Daily | Find brands in Trial phase past `trial_ends_at`. Transition to Expired. |
| Cancelled brand cleanup | Daily | Find brands in Cancelled phase past `hard_delete_after`. Permanently delete. |
| SKU annual reset | Daily (or lazy) | Find brands past their `sku_year_start` anniversary. Reset annual counter. |
| Trial reminder emails | Daily | Send reminders at day 10 and day 13 of trial. |

### Existing System Impact

The following existing systems will be affected and should be reviewed during each undertaking's research phase:

- **Product creation flow**: Must integrate SKU limit checks
- **Shopify integration**: Sync must respect SKU limits
- **Bulk import**: Must validate against remaining SKU budget before processing
- **Theme editor**: Should remain accessible during trial but blocked after expiry
- **QR code generation**: Should remain functional for existing passports even in blocked states
- **Public passport pages (DPP app)**: Must always remain accessible regardless of brand phase (passports are public by nature and must be live for compliance)
- **Dashboard layout**: Must integrate access policy checks and show appropriate UI states

### Important: Public Passport Availability

**Digital product passports must remain publicly accessible regardless of the brand's billing state.** Even if a brand is in Expired, Past Due, Suspended, or Cancelled phase, their existing passports must continue to be served on the public DPP app. This is a compliance requirement: taking passports offline would make the brand non-compliant, which is the opposite of what our platform is for.

The billing/access restrictions only affect the brand's ability to:
- Log into the management dashboard
- Create new products/SKUs
- Edit existing passports
- Access the theme editor
- Use integrations

They never affect the public visibility of existing passports.

---

## Summary of Implementation Order

| # | Undertaking | Scope | Key Deliverable |
|---|---|---|---|
| 1 | Database Layer | Schema redesign, migrations, backfill | `brand_lifecycle` + `brand_plan` + `brand_billing` foundations (+ billing events, webhook idempotency, admin audit logs) |
| 2 | Invite-Only Signup | Lock down signup, phase transitions on invite accept | Pre-auth enforcement, Demo-->Trial transition |
| 3 | Access Policy Engine | Centralized access decisions, enforcement hooks | `resolveBrandAccessDecision(...)` wired into app |
| 4 | Admin Panel | Separate Next.js app for founders | Brand list, create, manage, invite, billing actions |
| 5 | Stripe Integration | Payment processing, webhooks, subscription sync | Checkout, Invoices, webhook handler, billing tables |
| 6 | Billing UX | Customer-facing plan selection, paywall, billing settings | Trial banner, paywall, plan selector, `/settings/billing` |
| 7 | SKU Limit Enforcement | Creation-time limit checks, counters, UI feedback | Server-side enforcement, warning/blocked UI states |
| 8 | Cleanup & Hardening | Legacy removal, backfill, monitoring, runbook | Production-ready system |

---

## Undertaking 2 Progress Update (2026-02-28)

### Overall Status

- **Implementation status:** Undertaking 2 backend + customer-flow scope is implemented on `feature/provisioning`.
- **Current confidence:** Core invite-only auth gating is working in local manual checks (OTP and Google OAuth paths for existing vs non-existing accounts).
- **Known scope boundary:** Platform-admin UI is intentionally not included in U2 (TRPC primitives are in place for Undertaking 4 UI work).

### What Was Implemented

1. **Sub-plan artifacts completed**
- `docs/subscription/undertaking-2/research.md`
- `docs/subscription/undertaking-2/plan.md`
- `docs/subscription/undertaking-2/test.md`

2. **Database + auth hook foundation**
- `brand_members.role` supports `owner | member | avelero` in `packages/db/src/schema/brands/brand-members.ts`.
- Invite roles remain constrained to `owner | member` in `packages/db/src/schema/brands/brand-invites.ts`.
- Hook/functions migration implemented in:
  - `apps/api/supabase/migrations/20260228170130_invite_only_auth_and_lifecycle_hooks.sql`
- `is_brand_owner(uuid)` now treats `owner` and `avelero` as owner-equivalent.
- `accept_invite_from_cookie(text)` validates token/email and applies Demo -> Trial transition.
- `before_user_created_invite_gate(jsonb)` returns stable `INVITE_REQUIRED` rejection for non-invited new users.
- Supabase hook config points to PG function in `apps/api/supabase/config.toml`:
  - `[auth.hook.before_user_created]`
  - `uri = "pg-functions://postgres/public/before_user_created_invite_gate"`

3. **Invite flow hardening + lifecycle transition logic**
- Invite emails are normalized to lowercase on creation.
- Duplicate checks treat only non-expired invites as pending.
- Seat gate checks `max_seats`; `null` remains unlimited; owner counts exclude `avelero`.
- Invite acceptance is transactional and enforces:
  - invite exists
  - invite not expired
  - invite email matches accepting user email
- On `demo` brands, accepting `owner/member` invite transitions lifecycle to trial with 14-day window.
- Customer/admin invite list reads only pending non-expired invites.

4. **Role model changes (`avelero`)**
- API role constants include `AVELERO` in `apps/api/src/config/roles.ts`.
- Owner-equivalent helper introduced and used for owner-guarded procedures.
- Assignment schemas for customer/member invite flows remain `owner | member` only.
- Sole-owner and owner-count checks stay based on true `owner` (exclude `avelero`).
- Customer-facing member lists hide `avelero` rows.
- `composite.membersWithInvites` now includes `viewerRole` so UI can treat `avelero` viewer as owner-equivalent without exposing hidden rows.

5. **Platform-admin TRPC primitives (backend)**
- `platformAdminProcedure` added in `apps/api/src/trpc/init.ts` using `PLATFORM_ADMIN_EMAILS` allowlist (lowercased, comma-separated).
- `platformAdmin` router added in `apps/api/src/trpc/routers/_app.ts` with:
  - `platformAdmin.brands.create`
  - `platformAdmin.invites.send`
  - `platformAdmin.members.addSelf`
  - `platformAdmin.members.removeSelf`
- Audit rows are written to `platform_admin_audit_logs` for platform-admin actions.
- `PLATFORM_ADMIN_EMAILS` documented in `apps/api/.env.example`.

6. **OTP preflight + login UX + OAuth handling**
- Public endpoint `auth.otpPreflight` added in `apps/api/src/trpc/routers/auth/index.ts`.
- OTP login component now preflights before sending OTP (`apps/app/src/components/auth/otp-signin.tsx`).
- Login page copy/error presentation updated for invite-only flow:
  - `apps/app/src/app/(public)/login/page.tsx`
  - `apps/app/src/components/auth/login-feedback.tsx`
- OAuth callback error mapping updated in:
  - `apps/app/src/app/api/auth/callback/route.ts`

7. **Google OAuth implementation adjustment (current working approach)**
- Google auth moved to Google Identity Services ID-token popup flow in:
  - `apps/app/src/components/auth/google-signin.tsx`
- Flow now performs invite preflight before `supabase.auth.signInWithIdToken`.
- Single sign-in path is enforced (no second/duplicate Google sign-in prompt).
- Google button hover parity was restored on the custom button wrapper.

8. **Self-serve brand creation removed from customer paths**
- `user.brands.create` removed from customer API router.
- `/create-brand` now redirects to `/pending-access`.
- Redirect logic updated so no-membership users route to:
  - pending invites -> `/invites`
  - no invites -> `/pending-access`
- New `/pending-access` page added under dashboard routes.
- Customer CTAs/prefetches targeting self-serve brand creation were removed/updated.

### Migration Notes (Current State)

- Active hook/function migration file:
  - `apps/api/supabase/migrations/20260228170130_invite_only_auth_and_lifecycle_hooks.sql`
- Extra experimental migration created during OAuth debugging was removed:
  - `20260228194500_google_oauth_invite_gate_hardening.sql` (deleted)

### Manual Validation Snapshot

- Non-invited signup is blocked.
- Existing accounts can still sign in.
- Google sign-in currently lands correctly in app flow (no duplicate second Google prompt), and no-access users route to `/pending-access` as expected.
- OTP preflight returns:
  - `allowed=false, reason=invite_required` for non-invited/non-existing email
  - `allowed=true, reason=pending_invite` for invited email
  - `allowed=true, reason=existing_account` for existing users

### Remaining Follow-Ups / Next Agent Focus

1. Build Undertaking 4 admin UI on top of `platformAdmin.*` endpoints.
2. Complete end-to-end manual QA once admin UI exists (especially invite issue/acceptance from UI).
3. Keep validating Supabase hook behavior across local + deployed environments (config and callback behavior can differ per environment).

---

## Undertaking 3 Progress Update (2026-02-28)

### Overall Status

- **Implementation status:** Undertaking 3 is implemented across API policy resolution, tRPC enforcement, dashboard bootstrap contract, and dashboard access UI.
- **Current confidence:** Access behavior for `payment_required`, `past_due`, `suspended`, `cancelled`, and `avelero` bypass is covered by new unit + integration tests and passed local validation.
- **Scope boundary honored:** Undertaking 3 includes direct SKU-write enforcement + async “remaining > 0” guard hooks; full async all-or-nothing preflight remains Undertaking 7 scope.

### What Was Implemented

1. **Sub-plan artifacts completed**
- `docs/subscription/undertaking-3/research.md`
- `docs/subscription/undertaking-3/plan.md`
- `docs/subscription/undertaking-3/test.md`

2. **Access policy domain layer (API)**
- Added:
  - `apps/api/src/lib/access-policy/types.ts`
  - `apps/api/src/lib/access-policy/resolve-brand-access-decision.ts`
  - `apps/api/src/lib/access-policy/resolve-sku-access-decision.ts`
- Implemented precedence:
  - `avelero` role => always full access.
  - Active billing override `temporary_block` => suspended.
  - Active billing override `temporary_allow` => full access.
  - Phase mapping for `demo | trial | expired | active | past_due | suspended | cancelled`.
- Implemented capability mapping:
  - `full_access | trial_active` => read/write allowed.
  - `payment_required | past_due` => read only.
  - `suspended | cancelled` => read/write blocked.

3. **Brand access snapshot query (DB)**
- Added `packages/db/src/queries/brand/access.ts` with one-call snapshot fetch for lifecycle + billing + plan.
- Exported via `packages/db/src/queries/brand/index.ts`.

4. **Request-scoped access cache + tRPC procedure variants**
- Extended access context resolution in:
  - `apps/api/src/trpc/middleware/auth/brand.ts`
  - `apps/api/src/trpc/init.ts`
- Added/implemented:
  - `brandReadProcedure`
  - `brandWriteProcedure`
  - `brandSkuWriteProcedure`
  - `assertBrandWriteAccess(...)` for non-brand-scoped procedures.
- Added centralized SKU intended-count check helper:
  - `resolveSkuDecisionWithIntendedCount(...)`

5. **Router migration to new enforcement model**
- Migrated brand-scoped queries to `brandReadProcedure` and mutations to `brandWriteProcedure` across summary, notifications, composite, brand, catalog, products, integrations, and bulk routers.
- SKU-creating direct mutations use `brandSkuWriteProcedure`:
  - `products.variants.create`
  - `products.variants.batchCreate`
  - `products.variants.sync`
- `brand.delete` kept on `protectedProcedure` but now explicitly enforces write access via `assertBrandWriteAccess(...)`.

6. **SKU policy behavior for Undertaking 3**
- Implemented warning threshold `80%` and trial universal cap `50,000`.
- Direct create intended-count logic:
  - `create` => 1
  - `batchCreate` => `variants.length`
  - `sync` => count of variants to be newly created (no known UPID mapping)
- Async creation hooks (`bulk.import.start`, `integrations.sync.trigger`) enforce `remaining > 0` guard.

7. **Dashboard bootstrap contract enrichment**
- `apps/api/src/trpc/routers/composite/index.ts` `initDashboard` now includes:
  - `access.decision`
  - `access.capabilities`
  - `access.overlay`
  - `access.banner`
  - `access.phase`
  - `access.trialEndsAt`
  - `sku.status`
  - `sku.annual`
  - `sku.onboarding`
  - `sku.warningThreshold`
  - `sku.trialUniversalCap`
- Existing bootstrap keys preserved: `user`, `brands`, `myInvites`, `activeBrand`.

8. **Frontend access gating (layout-level)**
- Added:
  - `apps/app/src/components/access/payment-required-overlay.tsx`
  - `apps/app/src/components/access/past-due-banner.tsx`
  - `apps/app/src/components/access/blocked-access-screen.tsx`
- Updated `apps/app/src/app/(dashboard)/(main)/layout.tsx`:
  - Existing setup/invite/pending-access redirects retained.
  - `suspended`/`cancelled` => full blocked screen.
  - `payment_required` => non-dismissible overlay (content visible underneath).
  - `past_due` => non-dismissible top banner.

9. **Billing CTA route placeholder**
- Added placeholder billing page:
  - `apps/app/src/app/(dashboard)/(main)/(sidebar)/settings/billing/page.tsx`
- Added settings nav exposure:
  - `apps/app/src/lib/settings-navigation.ts`
  - `apps/app/src/components/settings/settings-secondary-sidebar.tsx`

10. **Stable access error helpers**
- Extended `apps/api/src/utils/errors.ts` with stable tokens:
  - `ACCESS_PAYMENT_REQUIRED`
  - `ACCESS_PAST_DUE_READ_ONLY`
  - `ACCESS_SUSPENDED`
  - `ACCESS_CANCELLED`
  - `ACCESS_SKU_LIMIT_REACHED`

11. **Tests added + validation hardening**
- Added policy unit tests:
  - `apps/api/__tests__/unit/access-policy/resolve-brand-access-decision.test.ts`
  - `apps/api/__tests__/unit/access-policy/resolve-sku-access-decision.test.ts`
- Added TRPC integration tests:
  - `apps/api/__tests__/integration/trpc/access-policy.test.ts`
- Stabilized test behavior found during run:
  - Moved passport creation for `products.variants.sync` into the same DB transaction to avoid FK timing issues.
  - Added retry logic in test table cleanup for transient deadlock/lock errors.
  - Widened `batchCreatePassportsForVariants` signature to accept `DatabaseOrTransaction`.

### Migration Notes (Current State)

- Undertaking 3 required **no new DB migrations**.
- Changes are application-layer policy, middleware, router, contract, and UI work on top of Undertaking 1 schema.

### Validation Snapshot

- `bun run test` (repo root): **pass**
- `bun typecheck` (repo root): **pass**
- `bun lint` (repo root): **pass**
- Specific access-policy integration coverage passes for:
  - `payment_required` (reads allowed, writes blocked)
  - `past_due` (reads allowed, writes blocked)
  - `suspended/cancelled` (reads+writes blocked)
  - `avelero` bypass
  - SKU blocked token behavior

### Remaining Follow-Ups / Next Agent Focus

1. Undertaking 6: replace billing placeholder with full billing UX and connect CTA flows.
2. Undertaking 7: complete async/bulk/integration SKU preflight behavior (full all-or-nothing where required).
3. Add/expand frontend route-level visual checks for overlays/banners/blocked screens across all `(main)` route variants.
