/**
 * Live Stripe billing test helpers.
 *
 * These helpers provision real Stripe objects inside the shared sandbox, wait
 * for forwarded webhooks to land in the disposable database, and clean up
 * clocks, subscriptions, customers, and checkout sessions after each test.
 */
import { and, desc, eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestUser,
  testDb,
} from "@v1/db/testing";
import type Stripe from "stripe";
import { createStripeClient } from "../../../src/lib/stripe/client";
import {
  TIER_CONFIG,
  type BillingInterval,
  type PlanTier,
} from "../../../src/lib/stripe/config";
import { createEnterpriseInvoice } from "../../../src/lib/stripe/invoice";
import { syncStripeInvoiceProjectionById } from "../../../src/lib/stripe/projection";
import { appRouter } from "../../../src/trpc/routers/_app";
import {
  addBrandMember,
  createMockContext,
  setBrandSubscriptionState,
  type BrandPhase,
} from "../../helpers/billing";

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_POLL_TIMEOUT_MS = 60_000;
const TEST_CLOCK_READY_TIMEOUT_MS = 90_000;
type LiveBillingInterval = BillingInterval;

let priceCatalogPreflightPromise: Promise<void> | null = null;

export interface LiveBrandHarness {
  brandId: string;
  brandName: string;
  ownerEmail: string;
  ownerId: string;
  caller: ReturnType<typeof appRouter.createCaller>;
}

export interface LiveStripeCleanupTracker {
  trackClock: (clockId: string) => void;
  trackCustomer: (customerId: string) => void;
  trackSubscription: (subscriptionId: string) => void;
  trackBrand: (brandId: string) => void;
  cleanup: () => Promise<void>;
}

export interface ProvisionedStripeBillingBrand {
  harness: LiveBrandHarness;
  stripe: Stripe;
  cleanup: LiveStripeCleanupTracker;
  clock: Stripe.TestHelpers.TestClock;
  customer: Stripe.Customer;
  paymentMethod: Stripe.PaymentMethod;
  subscription: Stripe.Subscription;
}

/**
 * Returns a fresh live Stripe client for direct sandbox operations.
 */
export function getLiveStripeClient(): Stripe {
  return createStripeClient(process.env.STRIPE_SECRET_KEY);
}

/**
 * Generates a compact unique suffix for test resource names and emails.
 */
export function createLiveTestSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Polls until a condition returns a truthy result or times out.
 */
export async function waitForCondition<T>(params: {
  description: string;
  evaluate: () => Promise<T>;
  isDone: (value: T) => boolean;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<T> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const intervalMs = params.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await params.evaluate();
    if (params.isDone(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for ${params.description}`);
}

/**
 * Ensures the configured Stripe price IDs exist and match their expected cadence.
 */
export async function ensureLiveStripePriceCatalog(): Promise<void> {
  if (!priceCatalogPreflightPromise) {
    priceCatalogPreflightPromise = (async () => {
      const stripe = getLiveStripeClient();

      for (const [tier, config] of Object.entries(TIER_CONFIG)) {
        for (const [interval, prices] of Object.entries(config.prices)) {
          for (const [productLine, priceId] of Object.entries(prices)) {
            const price = await stripe.prices.retrieve(priceId, {
              expand: ["product"],
            });

            if (!price.active) {
              throw new Error(
                `Configured Stripe price ${priceId} for ${tier}/${interval}/${productLine} is not active`,
              );
            }

            if (!price.recurring) {
              throw new Error(
                `Configured Stripe price ${priceId} for ${tier}/${interval}/${productLine} is not recurring`,
              );
            }

            const expectedInterval = interval === "quarterly" ? "month" : "year";
            if (price.recurring.interval !== expectedInterval) {
              throw new Error(
                `Configured Stripe price ${priceId} for ${tier}/${interval}/${productLine} has recurring interval ${price.recurring.interval}, expected ${expectedInterval}`,
              );
            }

            if (price.livemode) {
              throw new Error(
                `Configured Stripe price ${priceId} for ${tier}/${interval}/${productLine} points at live mode instead of the sandbox`,
              );
            }
          }
        }
      }
    })();
  }

  await priceCatalogPreflightPromise;
}

/**
 * Creates a test brand, owner membership, and default billing rows for live tests.
 */
export async function createLiveBillingBrand(params?: {
  namePrefix?: string;
  phase?: BrandPhase;
  planType?: PlanTier | "enterprise" | null;
  billingInterval?: LiveBillingInterval | null;
  billingMode?: "stripe_checkout" | "stripe_invoice" | null;
}): Promise<LiveBrandHarness> {
  const suffix = createLiveTestSuffix();
  const brandName = `${params?.namePrefix ?? "Live Billing Brand"} ${suffix}`;
  const ownerEmail = `live-billing-${suffix}@example.com`;
  const ownerId = await createTestUser(ownerEmail);
  const brandId = await createTestBrand(brandName);

  await addBrandMember(ownerId, brandId);
  await setBrandSubscriptionState({
    brandId,
    phase: params?.phase ?? "demo",
    planType: params?.planType ?? null,
    billingInterval: params?.billingInterval ?? null,
    billingMode: params?.billingMode ?? null,
  });

  const caller = appRouter.createCaller(
    createMockContext({
      userId: ownerId,
      userEmail: ownerEmail,
      brandId,
      role: "owner",
    }),
  );

  return {
    brandId,
    brandName,
    ownerEmail,
    ownerId,
    caller,
  };
}

/**
 * Creates a cleanup tracker for Stripe resources provisioned during a test.
 */
export function createLiveStripeCleanupTracker(
  stripe: Stripe = getLiveStripeClient(),
): LiveStripeCleanupTracker {
  const clockIds = new Set<string>();
  const customerIds = new Set<string>();
  const subscriptionIds = new Set<string>();
  const brandIds = new Set<string>();

  return {
    /**
     * Track a brand whose Stripe-backed billing projection must settle before teardown ends.
     */
    trackBrand(brandId) {
      brandIds.add(brandId);
    },
    trackClock(clockId) {
      clockIds.add(clockId);
    },
    trackCustomer(customerId) {
      customerIds.add(customerId);
    },
    trackSubscription(subscriptionId) {
      subscriptionIds.add(subscriptionId);
    },
    async cleanup() {
      for (const customerId of customerIds) {
        try {
          const sessions = await stripe.checkout.sessions.list({
            customer: customerId,
            limit: 20,
            status: "open",
          });

          for (const session of sessions.data) {
            await stripe.checkout.sessions.expire(session.id);
          }
        } catch {
          // Ignore checkout session cleanup failures during test teardown.
        }
      }

      for (const subscriptionId of subscriptionIds) {
        try {
          await stripe.subscriptions.cancel(subscriptionId);
        } catch {
          // Ignore subscription cleanup failures during test teardown.
        }
      }

      for (const brandId of brandIds) {
        try {
          await waitForCondition({
            description: `billing teardown for brand ${brandId}`,
            timeoutMs: 30_000,
            evaluate: async () => readLiveBrandBillingState(brandId),
            isDone: (state) => !state.billing?.stripeSubscriptionId,
          });
        } catch {
          // Ignore webhook settlement failures during test teardown.
        }
      }

      for (const clockId of clockIds) {
        try {
          await stripe.testHelpers.testClocks.del(clockId);
        } catch {
          // Ignore clock cleanup failures during test teardown.
        }
      }

      for (const customerId of customerIds) {
        try {
          await stripe.customers.del(customerId);
        } catch {
          // Ignore customer cleanup failures during test teardown.
        }
      }
    },
  };
}

/**
 * Creates a Stripe test clock anchored to a deterministic instant.
 */
export async function createStripeTestClock(params?: {
  stripe?: Stripe;
  frozenTime?: Date;
  name?: string;
}): Promise<Stripe.TestHelpers.TestClock> {
  const stripe = params?.stripe ?? getLiveStripeClient();
  return stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(
      (params?.frozenTime ?? new Date("2026-01-01T09:00:00.000Z")).getTime() /
        1000,
    ),
    name: params?.name,
  });
}

/**
 * Waits until Stripe reports that a test clock is ready for more work.
 */
export async function waitForStripeTestClockReady(params: {
  stripe?: Stripe;
  clockId: string;
  timeoutMs?: number;
}): Promise<Stripe.TestHelpers.TestClock> {
  const stripe = params.stripe ?? getLiveStripeClient();

  return waitForCondition({
    description: `test clock ${params.clockId} to become ready`,
    timeoutMs: params.timeoutMs ?? TEST_CLOCK_READY_TIMEOUT_MS,
    evaluate: async () =>
      stripe.testHelpers.testClocks.retrieve(params.clockId),
    isDone: (clock) => clock.status === "ready",
  });
}

/**
 * Advances a test clock and waits until all simulated billing work has finished.
 */
export async function advanceStripeTestClock(params: {
  stripe?: Stripe;
  clockId: string;
  frozenTime: Date;
}): Promise<Stripe.TestHelpers.TestClock> {
  const stripe = params.stripe ?? getLiveStripeClient();

  await stripe.testHelpers.testClocks.advance(params.clockId, {
    frozen_time: Math.floor(params.frozenTime.getTime() / 1000),
  });

  return waitForStripeTestClockReady({
    stripe,
    clockId: params.clockId,
  });
}

/**
 * After a test-clock advance, Stripe sometimes leaves the renewal invoice in
 * `draft` and never auto-finalizes it. This helper polls for a draft invoice
 * on the subscription and explicitly finalizes it so the payment attempt (and
 * any resulting failure) actually fires.
 */
export async function finalizeDraftRenewalInvoice(params: {
  stripe?: Stripe;
  subscriptionId: string;
  knownInvoiceIds?: Set<string>;
}): Promise<Stripe.Invoice> {
  const stripe = params.stripe ?? getLiveStripeClient();

  const invoice = await waitForCondition({
    description: `draft renewal invoice on subscription ${params.subscriptionId}`,
    timeoutMs: 30_000,
    evaluate: async () => {
      const invoices = await stripe.invoices.list({
        subscription: params.subscriptionId,
        status: "draft",
        limit: 5,
      });
      return invoices.data.find(
        (inv) => !params.knownInvoiceIds?.has(inv.id),
      ) ?? null;
    },
    isDone: (inv) => inv !== null,
  });

  return stripe.invoices.finalizeInvoice(invoice!.id);
}

/**
 * Maps well-known Stripe test card numbers to their token equivalents so tests
 * never send raw PANs (which requires special account access).
 * See: https://docs.stripe.com/testing#cards
 */
const TEST_CARD_TOKENS: Record<string, string> = {
  "4242424242424242": "tok_visa",
  // "Decline after attaching" — attaches to Customer successfully, charges fail.
  "4000000000000341": "tok_chargeCustomerFail",
};

/**
 * Maps card numbers to Stripe's pre-built `pm_card_*` PaymentMethod IDs.
 * These work reliably with Stripe Billing / PaymentIntents (unlike legacy
 * tok_* tokens which may not trigger payment failures in modern flows).
 * See: https://docs.stripe.com/testing#cards
 */
const TEST_CARD_PM_IDS: Record<string, string> = {
  "4000000000000341": "pm_card_chargeCustomerFail",
};

/**
 * Creates a reusable card PaymentMethod for the requested test card behavior.
 */
export async function createCardPaymentMethod(params?: {
  stripe?: Stripe;
  cardNumber?: string;
}): Promise<Stripe.PaymentMethod> {
  const stripe = params?.stripe ?? getLiveStripeClient();
  const cardNumber = params?.cardNumber ?? "4242424242424242";
  const token = TEST_CARD_TOKENS[cardNumber];

  if (!token) {
    throw new Error(
      `No test token mapping for card ${cardNumber}. Add it to TEST_CARD_TOKENS in live-billing.ts.`,
    );
  }

  return stripe.paymentMethods.create({
    type: "card",
    card: { token },
  });
}

/**
 * Attaches a card PaymentMethod to a customer and sets it as the invoice default.
 *
 * For cards that have a `pm_card_*` mapping (e.g. charge-decline test cards),
 * the pre-built PaymentMethod ID is attached directly so that Stripe Billing
 * correctly triggers payment failures.
 */
export async function attachCustomerCardPaymentMethod(params: {
  stripe?: Stripe;
  customerId: string;
  cardNumber?: string;
  subscriptionId?: string;
}): Promise<Stripe.PaymentMethod> {
  const stripe = params.stripe ?? getLiveStripeClient();
  const cardNumber = params.cardNumber ?? "4242424242424242";

  // Prefer pm_card_* IDs for cards that need special billing behavior
  const pmId = TEST_CARD_PM_IDS[cardNumber];
  let paymentMethod: Stripe.PaymentMethod;

  if (pmId) {
    paymentMethod = await stripe.paymentMethods.attach(pmId, {
      customer: params.customerId,
    });
  } else {
    paymentMethod = await createCardPaymentMethod({
      stripe,
      cardNumber,
    });
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: params.customerId,
    });
  }

  await stripe.customers.update(params.customerId, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });

  if (params.subscriptionId) {
    // Existing subscriptions can keep charging their own default payment method,
    // so update the subscription as well when tests need renewal behavior to flip.
    await stripe.subscriptions.update(params.subscriptionId, {
      default_payment_method: paymentMethod.id,
    });
  }

  return paymentMethod;
}

/**
 * Creates a Stripe customer on an optional test clock with default card details.
 */
export async function createClockCustomer(params: {
  stripe?: Stripe;
  clockId?: string;
  brandId: string;
  email: string;
  name: string;
  testRunId: string;
  scenario: string;
  cardNumber?: string;
}): Promise<{
  customer: Stripe.Customer;
  paymentMethod: Stripe.PaymentMethod;
}> {
  const stripe = params.stripe ?? getLiveStripeClient();
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    test_clock: params.clockId,
    metadata: {
      brand_id: params.brandId,
      test_run_id: params.testRunId,
      scenario: params.scenario,
    },
  });

  const paymentMethod = await attachCustomerCardPaymentMethod({
    stripe,
    customerId: customer.id,
    cardNumber: params.cardNumber,
  });

  await testDb
    .update(schema.brandBilling)
    .set({
      stripeCustomerId: customer.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.brandBilling.brandId, params.brandId));

  return { customer, paymentMethod };
}

/**
 * Creates a real Stripe subscription with the configured plan line items.
 */
export async function createStripeSubscriptionForBrand(params: {
  stripe?: Stripe;
  customerId: string;
  brandId: string;
  tier: PlanTier;
  interval: LiveBillingInterval;
  includeImpact?: boolean;
  trialDays?: number;
  testRunId: string;
  scenario: string;
}): Promise<Stripe.Subscription> {
  const stripe = params.stripe ?? getLiveStripeClient();
  const prices = TIER_CONFIG[params.tier].prices[params.interval];
  const items: Stripe.SubscriptionCreateParams.Item[] = [
    { price: prices.avelero },
  ];

  if (params.includeImpact) {
    items.push({ price: prices.impact });
  }

  return stripe.subscriptions.create({
    customer: params.customerId,
    items,
    metadata: {
      brand_id: params.brandId,
      plan_type: params.tier,
      billing_interval: params.interval,
      include_impact: String(params.includeImpact ?? false),
      test_run_id: params.testRunId,
      scenario: params.scenario,
    },
    ...(params.trialDays
      ? { trial_period_days: params.trialDays }
      : {}),
  });
}

/**
 * Creates an enterprise invoice using the real production helper.
 */
export async function createLiveEnterpriseInvoice(params: {
  brandId: string;
  stripeCustomerId: string;
  amountCents: number;
  description: string;
  recipientName: string;
  recipientEmail: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  dueDate?: string | null;
  daysUntilDue?: number | null;
  internalReference?: string | null;
}): Promise<{
  invoiceId: string;
  invoiceUrl: string | null;
  status: string;
}> {
  // Mirror the production platform-admin flow by syncing the invoice projection
  // immediately after Stripe creates and sends the invoice.
  const invoice = await createEnterpriseInvoice({
    brandId: params.brandId,
    stripeCustomerId: params.stripeCustomerId,
    amountCents: params.amountCents,
    description: params.description,
    recipient: {
      name: params.recipientName,
      email: params.recipientEmail,
    },
    servicePeriodStart: params.servicePeriodStart,
    servicePeriodEnd: params.servicePeriodEnd,
    dueDate: params.dueDate ?? null,
    daysUntilDue: params.daysUntilDue ?? null,
    internalReference: params.internalReference ?? null,
  });

  await syncStripeInvoiceProjectionById({
    db: testDb,
    invoiceId: invoice.invoiceId,
    brandId: params.brandId,
  });

  return invoice;
}

/**
 * Reads the current billing, lifecycle, and plan projection for a brand.
 */
export async function readLiveBrandBillingState(brandId: string): Promise<{
  billing: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeSubscriptionScheduleId: string | null;
    billingMode: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    pastDueSince: string | null;
    pendingCancellation: boolean;
    scheduledPlanType: string | null;
    scheduledBillingInterval: string | null;
    scheduledHasImpactPredictions: boolean | null;
    scheduledPlanChangeEffectiveAt: string | null;
    updatedAt: string | null;
  } | null;
  lifecycle: {
    phase: string;
    cancelledAt: string | null;
    hardDeleteAfter: string | null;
  } | null;
  plan: {
    planType: string | null;
    billingInterval: string | null;
    hasImpactPredictions: boolean;
  } | null;
}> {
  const [billing] = await testDb
    .select({
      stripeCustomerId: schema.brandBilling.stripeCustomerId,
      stripeSubscriptionId: schema.brandBilling.stripeSubscriptionId,
      stripeSubscriptionScheduleId: schema.brandBilling.stripeSubscriptionScheduleId,
      billingMode: schema.brandBilling.billingMode,
      currentPeriodStart: schema.brandBilling.currentPeriodStart,
      currentPeriodEnd: schema.brandBilling.currentPeriodEnd,
      pastDueSince: schema.brandBilling.pastDueSince,
      pendingCancellation: schema.brandBilling.pendingCancellation,
      scheduledPlanType: schema.brandBilling.scheduledPlanType,
      scheduledBillingInterval: schema.brandBilling.scheduledBillingInterval,
      scheduledHasImpactPredictions:
        schema.brandBilling.scheduledHasImpactPredictions,
      scheduledPlanChangeEffectiveAt:
        schema.brandBilling.scheduledPlanChangeEffectiveAt,
      updatedAt: schema.brandBilling.updatedAt,
    })
    .from(schema.brandBilling)
    .where(eq(schema.brandBilling.brandId, brandId))
    .limit(1);

  const [lifecycle] = await testDb
    .select({
      phase: schema.brandLifecycle.phase,
      cancelledAt: schema.brandLifecycle.cancelledAt,
      hardDeleteAfter: schema.brandLifecycle.hardDeleteAfter,
    })
    .from(schema.brandLifecycle)
    .where(eq(schema.brandLifecycle.brandId, brandId))
    .limit(1);

  const [plan] = await testDb
    .select({
      planType: schema.brandPlan.planType,
      billingInterval: schema.brandPlan.billingInterval,
      hasImpactPredictions: schema.brandPlan.hasImpactPredictions,
    })
    .from(schema.brandPlan)
    .where(eq(schema.brandPlan.brandId, brandId))
    .limit(1);

  return {
    billing: billing ?? null,
    lifecycle: lifecycle ?? null,
    plan: plan ?? null,
  };
}

/**
 * Waits until a brand reaches the requested lifecycle phase.
 */
export async function waitForBrandPhase(
  brandId: string,
  phase: string,
): Promise<void> {
  await waitForCondition({
    description: `brand ${brandId} phase ${phase}`,
    evaluate: async () => readLiveBrandBillingState(brandId),
    isDone: (state) => state.lifecycle?.phase === phase,
  });
}

/**
 * Waits until the brand billing projection has a live subscription ID.
 */
export async function waitForLiveSubscriptionProjection(brandId: string): Promise<{
  stripeSubscriptionId: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}> {
  const state = await waitForCondition({
    description: `brand ${brandId} Stripe subscription projection`,
    evaluate: async () => readLiveBrandBillingState(brandId),
    isDone: (value) => !!value.billing?.stripeSubscriptionId,
  });

  return {
    stripeSubscriptionId: state.billing!.stripeSubscriptionId!,
    currentPeriodStart: state.billing!.currentPeriodStart,
    currentPeriodEnd: state.billing!.currentPeriodEnd,
  };
}

/**
 * Waits until the latest matching billing event is persisted.
 */
export async function waitForBillingEvent(params: {
  brandId: string;
  eventType: string;
}): Promise<{
  id: string;
  stripeEventId: string | null;
  payload: unknown;
}> {
  const event = await waitForCondition({
    description: `billing event ${params.eventType} for brand ${params.brandId}`,
    evaluate: async () => {
      const [event] = await testDb
        .select({
          id: schema.brandBillingEvents.id,
          stripeEventId: schema.brandBillingEvents.stripeEventId,
          payload: schema.brandBillingEvents.payload,
          eventType: schema.brandBillingEvents.eventType,
        })
        .from(schema.brandBillingEvents)
        .where(
          and(
            eq(schema.brandBillingEvents.brandId, params.brandId),
            eq(schema.brandBillingEvents.eventType, params.eventType),
          ),
        )
        .orderBy(desc(schema.brandBillingEvents.createdAt))
        .limit(1);

      return event ?? null;
    },
    isDone: (event) => event?.eventType === params.eventType,
  });

  return {
    id: event!.id,
    stripeEventId: event!.stripeEventId,
    payload: event!.payload,
  };
}

/**
 * Waits until a Stripe invoice projection row exists for the brand.
 */
export async function waitForInvoiceProjection(params: {
  brandId: string;
  invoiceId?: string;
  status?: string;
}): Promise<{
  stripeInvoiceId: string;
  status: string;
  collectionMethod: string;
  total: number;
  amountDue: number;
  amountPaid: number;
  hostedInvoiceUrl: string | null;
}> {
  const invoice = await waitForCondition({
    description: `invoice projection for brand ${params.brandId}`,
    evaluate: async () => {
      const conditions = [eq(schema.brandBillingInvoices.brandId, params.brandId)];

      if (params.invoiceId) {
        conditions.push(
          eq(schema.brandBillingInvoices.stripeInvoiceId, params.invoiceId),
        );
      }

      if (params.status) {
        conditions.push(eq(schema.brandBillingInvoices.status, params.status));
      }

      const query = testDb
        .select({
          stripeInvoiceId: schema.brandBillingInvoices.stripeInvoiceId,
          status: schema.brandBillingInvoices.status,
          collectionMethod: schema.brandBillingInvoices.collectionMethod,
          total: schema.brandBillingInvoices.total,
          amountDue: schema.brandBillingInvoices.amountDue,
          amountPaid: schema.brandBillingInvoices.amountPaid,
          hostedInvoiceUrl: schema.brandBillingInvoices.hostedInvoiceUrl,
        })
        .from(schema.brandBillingInvoices)
        .where(and(...conditions))
        .orderBy(desc(schema.brandBillingInvoices.createdAt))
        .limit(1);

      const [invoice] = await query;
      return invoice ?? null;
    },
    isDone: (invoice) => {
      if (!invoice) return false;
      if (params.invoiceId && invoice.stripeInvoiceId !== params.invoiceId) {
        return false;
      }
      if (params.status && invoice.status !== params.status) {
        return false;
      }
      return true;
    },
  });

  return {
    stripeInvoiceId: invoice!.stripeInvoiceId,
    status: invoice!.status,
    collectionMethod: invoice!.collectionMethod ?? "unknown",
    total: invoice!.total ?? 0,
    amountDue: invoice!.amountDue,
    amountPaid: invoice!.amountPaid,
    hostedInvoiceUrl: invoice!.hostedInvoiceUrl,
  };
}

/**
 * Lists the currently open checkout sessions for a Stripe customer.
 */
export async function listOpenCheckoutSessions(params: {
  stripe?: Stripe;
  customerId: string;
}): Promise<Array<Stripe.Checkout.Session>> {
  const stripe = params.stripe ?? getLiveStripeClient();
  const sessions = await stripe.checkout.sessions.list({
    customer: params.customerId,
    limit: 20,
    status: "open",
  });

  return sessions.data;
}

/**
 * Lists line items for a Checkout Session so tests can assert real pricing.
 */
export async function listCheckoutSessionLineItems(params: {
  stripe?: Stripe;
  sessionId: string;
}): Promise<Array<Stripe.LineItem>> {
  const stripe = params.stripe ?? getLiveStripeClient();
  const lineItems = await stripe.checkout.sessions.listLineItems(
    params.sessionId,
    { limit: 20 },
  );
  return lineItems.data;
}

/**
 * Provisions a live active Stripe-backed brand by creating a clocked customer and subscription.
 */
export async function provisionActiveStripeBillingBrand(params?: {
  namePrefix?: string;
  tier?: PlanTier;
  interval?: LiveBillingInterval;
  includeImpact?: boolean;
  cardNumber?: string;
  trialDays?: number;
}): Promise<ProvisionedStripeBillingBrand> {
  const stripe = getLiveStripeClient();
  const cleanup = createLiveStripeCleanupTracker(stripe);
  const testRunId = createLiveTestSuffix();
  const harness = await createLiveBillingBrand({
    namePrefix: params?.namePrefix ?? "Provisioned Live Billing Brand",
  });
  cleanup.trackBrand(harness.brandId);

  const clock = await createStripeTestClock({
    stripe,
    frozenTime: new Date(),
    name: `${harness.brandId}-clock`,
  });
  cleanup.trackClock(clock.id);

  const { customer, paymentMethod } = await createClockCustomer({
    stripe,
    clockId: clock.id,
    brandId: harness.brandId,
    email: harness.ownerEmail,
    name: harness.brandName,
    testRunId,
    scenario: params?.namePrefix ?? "live-billing",
    cardNumber: params?.cardNumber,
  });
  cleanup.trackCustomer(customer.id);

  const subscription = await createStripeSubscriptionForBrand({
    stripe,
    customerId: customer.id,
    brandId: harness.brandId,
    tier: params?.tier ?? "starter",
    interval: params?.interval ?? "quarterly",
    includeImpact: params?.includeImpact ?? false,
    trialDays: params?.trialDays,
    testRunId,
    scenario: params?.namePrefix ?? "live-billing",
  });
  cleanup.trackSubscription(subscription.id);

  if (params?.trialDays) {
    await advanceStripeTestClock({
      stripe,
      clockId: clock.id,
      frozenTime: new Date(
        clock.frozen_time * 1000 +
          (params.trialDays * 24 * 60 * 60 + 2 * 60 * 60) * 1000,
      ),
    });
  }

  await waitForBrandPhase(harness.brandId, "active");
  await waitForLiveSubscriptionProjection(harness.brandId);

  return {
    harness,
    stripe,
    cleanup,
    clock,
    customer,
    paymentMethod,
    subscription,
  };
}
