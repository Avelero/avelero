/**
 * Stripe helpers for mutating live subscriptions.
 */
import type Stripe from "stripe";
import { getStripeClient } from "./client.js";
import {
  TIER_CONFIG,
  resolvePriceId,
  type BillingInterval,
  type PlanTier,
} from "./config.js";

/**
 * Add Impact Predictions to an existing subscription.
 *
 * Retrieves the subscription first to check whether an Impact line item
 * already exists (idempotency). If it does, this is a no-op. Otherwise
 * appends a new line item for the matching Impact price.
 * Stripe handles proration automatically.
 */
export async function addImpactToSubscription(opts: {
  stripeSubscriptionId: string;
  tier: PlanTier;
  interval: BillingInterval;
}): Promise<void> {
  // Fetch the latest subscription state so add-on updates stay idempotent.
  const { stripeSubscriptionId, tier, interval } = opts;
  const stripe = getStripeClient();

  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Check if an Impact item already exists
  const existingImpact = subscription.items.data.some((item) => {
    const resolved = resolvePriceId(item.price.id);
    return resolved?.product === "impact";
  });

  if (existingImpact) {
    return; // Already has Impact — no-op
  }

  const impactPriceId = TIER_CONFIG[tier].prices[interval].impact;

  await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ price: impactPriceId }],
    metadata: { include_impact: "true" },
    proration_behavior: "create_prorations",
  });
}

/**
 * Remove Impact Predictions from an existing subscription.
 *
 * Retrieves the subscription, finds the Impact line item via
 * `resolvePriceId()`, and deletes it. If no Impact item exists this
 * is a no-op (idempotent).
 */
export async function removeImpactFromSubscription(opts: {
  stripeSubscriptionId: string;
}): Promise<void> {
  // Fetch the latest subscription state so add-on removals stay idempotent.
  const { stripeSubscriptionId } = opts;
  const stripe = getStripeClient();

  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const impactItem = subscription.items.data.find((item) => {
    const resolved = resolvePriceId(item.price.id);
    return resolved?.product === "impact";
  });

  if (!impactItem) {
    return; // No Impact item — no-op
  }

  await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: impactItem.id, deleted: true }],
    metadata: { include_impact: "false" },
    proration_behavior: "create_prorations",
  });
}

/**
 * Resolves the current tier and interval from a live subscription's line items.
 */
export function resolveCurrentPlan(
  subscription: { items: { data: Array<{ price: { id: string } }> } },
): { tier: PlanTier; interval: BillingInterval } | null {
  for (const item of subscription.items.data) {
    const resolved = resolvePriceId(item.price.id);
    if (resolved?.product === "avelero") {
      return { tier: resolved.tier, interval: resolved.interval };
    }
  }
  return null;
}

/**
 * Builds schedule phase items that preserve the current subscription lineup.
 */
function buildCurrentSchedulePhaseItems(
  subscription: Stripe.Subscription,
): Array<{ price: string; quantity: number }> {
  // Copy the current recurring prices into the active schedule phase unchanged.
  const items: Array<{ price: string; quantity: number }> = [];
  let foundAvelero = false;

  for (const item of subscription.items.data) {
    const resolved = resolvePriceId(item.price.id);
    if (!resolved) {
      throw new Error(
        `Subscription ${subscription.id} contains unrecognised price ${item.price.id}. Cannot safely schedule a plan change.`,
      );
    }

    if (resolved.product === "avelero") {
      foundAvelero = true;
    }

    items.push({
      price: item.price.id,
      quantity: item.quantity ?? 1,
    });
  }

  if (!foundAvelero) {
    throw new Error(
      `Subscription ${subscription.id} has no Avelero line item. Cannot schedule a plan change.`,
    );
  }

  return items;
}

/**
 * Builds schedule phase items for the requested future plan state.
 */
function buildTargetSchedulePhaseItems(params: {
  newTier: PlanTier;
  newInterval: BillingInterval;
  hasImpact: boolean;
}): Array<{ price: string; quantity: number }> {
  // Encode the future recurring price lineup that should begin next cycle.
  const prices = TIER_CONFIG[params.newTier].prices[params.newInterval];
  const items = [{ price: prices.avelero, quantity: 1 }];

  if (params.hasImpact) {
    items.push({ price: prices.impact, quantity: 1 });
  }

  return items;
}

/**
 * Resolves the active phase window that the current subscription is already in.
 */
function resolveCurrentPhaseWindow(params: {
  subscription: Stripe.Subscription;
  schedule: Stripe.SubscriptionSchedule | null;
}): { startDate: number; endDate: number } {
  // Prefer Stripe's schedule current-phase bounds and fall back to subscription periods.
  const subscriptionPeriods = params.subscription as Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const startDate =
    params.schedule?.current_phase?.start_date ??
    subscriptionPeriods.current_period_start ??
    null;
  const endDate =
    params.schedule?.current_phase?.end_date ??
    subscriptionPeriods.current_period_end ??
    null;

  if (startDate === null || endDate === null) {
    throw new Error(
      `Subscription ${params.subscription.id} is missing a current billing window. Cannot schedule a plan change.`,
    );
  }

  return { startDate, endDate };
}

/**
 * Calculates the end of the first downgraded billing cycle after the phase starts.
 */
export function resolveScheduledPhaseEndDate(
  startDate: number,
  interval: BillingInterval,
): number {
  // Bound the last scheduled phase to one full billing cycle before releasing it.
  const phaseEnd = addUtcMonthsClamped(
    new Date(startDate * 1000),
    interval === "quarterly" ? 3 : 12,
  );

  return Math.floor(phaseEnd.getTime() / 1000);
}

/**
 * Adds whole UTC months while clamping to the target month's last day.
 */
function addUtcMonthsClamped(startDate: Date, months: number): Date {
  // Preserve wall-clock time and clamp month-end dates like Jan 31 -> Apr 30.
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth();
  const day = startDate.getUTCDate();
  const hours = startDate.getUTCHours();
  const minutes = startDate.getUTCMinutes();
  const seconds = startDate.getUTCSeconds();
  const milliseconds = startDate.getUTCMilliseconds();

  const targetStart = new Date(
    Date.UTC(year, month + months, 1, hours, minutes, seconds, milliseconds),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(
      targetStart.getUTCFullYear(),
      targetStart.getUTCMonth() + 1,
      0,
      hours,
      minutes,
      seconds,
      milliseconds,
    ),
  ).getUTCDate();

  targetStart.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return targetStart;
}

/**
 * Loads or creates the Stripe subscription schedule that will carry future phases.
 */
async function getOrCreateSubscriptionSchedule(params: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
}): Promise<Stripe.SubscriptionSchedule> {
  // Reuse the existing active schedule when one already manages this subscription.
  const { stripe, subscription } = params;

  if (subscription.schedule && typeof subscription.schedule !== "string") {
    if (
      subscription.schedule.status === "active" ||
      subscription.schedule.status === "not_started"
    ) {
      return subscription.schedule;
    }
  }

  if (typeof subscription.schedule === "string") {
    const existingSchedule = await stripe.subscriptionSchedules.retrieve(
      subscription.schedule,
    );

    if (
      existingSchedule.status === "active" ||
      existingSchedule.status === "not_started"
    ) {
      return existingSchedule;
    }
  }

  return stripe.subscriptionSchedules.create({
    from_subscription: subscription.id,
  });
}

/**
 * Loads the current Stripe subscription schedule when one is actively managing the subscription.
 */
async function getExistingSubscriptionSchedule(params: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
}): Promise<Stripe.SubscriptionSchedule | null> {
  // Normalize expanded and unexpanded schedule references into one active schedule object.
  const { stripe, subscription } = params;

  if (subscription.schedule && typeof subscription.schedule !== "string") {
    return subscription.schedule.status === "active" ||
      subscription.schedule.status === "not_started"
      ? subscription.schedule
      : null;
  }

  if (typeof subscription.schedule !== "string") {
    return null;
  }

  const schedule = await stripe.subscriptionSchedules.retrieve(
    subscription.schedule,
  );
  return schedule.status === "active" || schedule.status === "not_started"
    ? schedule
    : null;
}

/**
 * Schedules a downgrade to begin at the end of the current billing period.
 */
export async function scheduleSubscriptionPlanChange(opts: {
  stripeSubscriptionId: string;
  newTier: PlanTier;
  newInterval: BillingInterval;
  hasImpact: boolean;
}): Promise<{ scheduleId: string; effectiveAt: string }> {
  // Create or update a subscription schedule so the lower tier starts next cycle.
  const { stripeSubscriptionId, newTier, newInterval, hasImpact } = opts;
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["schedule"],
  });
  const schedule = await getOrCreateSubscriptionSchedule({ stripe, subscription });
  const currentPhaseItems = buildCurrentSchedulePhaseItems(subscription);
  const targetPhaseItems = buildTargetSchedulePhaseItems({
    newTier,
    newInterval,
    hasImpact,
  });
  const { startDate, endDate } = resolveCurrentPhaseWindow({
    subscription,
    schedule,
  });
  const futurePhaseEndDate = resolveScheduledPhaseEndDate(endDate, newInterval);

  const updatedSchedule = await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        start_date: startDate,
        end_date: endDate,
        items: currentPhaseItems,
        proration_behavior: "none",
      },
      {
        start_date: endDate,
        end_date: futurePhaseEndDate,
        items: targetPhaseItems,
        proration_behavior: "none",
      },
    ],
  });

  return {
    scheduleId: updatedSchedule.id,
    effectiveAt: new Date(endDate * 1000).toISOString(),
  };
}

/**
 * Cancels any pending subscription schedule so the current subscription keeps renewing as-is.
 */
export async function cancelScheduledSubscriptionPlanChange(opts: {
  stripeSubscriptionId: string;
}): Promise<{ scheduleId: string | null }> {
  // Release the active schedule so future phase changes are removed immediately.
  const { stripeSubscriptionId } = opts;
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["schedule"],
  });
  const schedule = await getExistingSubscriptionSchedule({ stripe, subscription });

  if (!schedule) {
    return { scheduleId: null };
  }

  if (schedule.status === "active") {
    await stripe.subscriptionSchedules.release(schedule.id);
    return { scheduleId: schedule.id };
  }

  if (schedule.status === "not_started") {
    await stripe.subscriptionSchedules.cancel(schedule.id);
    return { scheduleId: schedule.id };
  }

  return { scheduleId: null };
}

/**
 * Update the plan tier and/or interval for an existing subscription.
 *
 * Swaps every line item's price to the new tier/interval equivalent.
 * If `hasImpact` is true but no Impact line item exists, one is added.
 * If `hasImpact` is false but an Impact line item exists, it is removed.
 *
 * This helper only handles non-upgrade mutations on an existing subscription.
 * Upgrades use a fresh checkout flow so the new billing cycle can start
 * immediately without prorating the in-place subscription.
 */
export async function updateSubscriptionPlan(opts: {
  stripeSubscriptionId: string;
  newTier: PlanTier;
  newInterval: BillingInterval;
  hasImpact: boolean;
}): Promise<void> {
  const { stripeSubscriptionId, newTier, newInterval, hasImpact } = opts;
  const stripe = getStripeClient();

  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const newPrices = TIER_CONFIG[newTier].prices[newInterval];
  const items: Array<{
    id?: string;
    price?: string;
    deleted?: boolean;
  }> = [];

  let hasExistingImpact = false;
  let foundAvelero = false;

  for (const item of subscription.items.data) {
    const resolved = resolvePriceId(item.price.id);
    if (!resolved) {
      throw new Error(
        `Subscription ${stripeSubscriptionId} contains unrecognised price ${item.price.id}. Cannot safely update — manual intervention required.`,
      );
    }

    if (resolved.product === "avelero") {
      foundAvelero = true;
      items.push({ id: item.id, price: newPrices.avelero });
    } else if (resolved.product === "impact") {
      hasExistingImpact = true;
      if (hasImpact) {
        items.push({ id: item.id, price: newPrices.impact });
      } else {
        items.push({ id: item.id, deleted: true });
      }
    }
  }

  if (!foundAvelero) {
    throw new Error(
      `Subscription ${stripeSubscriptionId} has no Avelero line item. Cannot update plan — subscription may be in an inconsistent state.`,
    );
  }

  // Add Impact line item if requested but not currently present
  if (hasImpact && !hasExistingImpact) {
    items.push({ price: newPrices.impact });
  }

  await stripe.subscriptions.update(stripeSubscriptionId, {
    items,
    cancel_at_period_end: false,
    metadata: {
      plan_type: newTier,
      billing_interval: newInterval,
      include_impact: String(hasImpact),
    },
    proration_behavior: "none",
  });
}
