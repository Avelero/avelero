/**
 * Product × tier × interval Stripe catalog definitions.
 *
 * Maps the paid plan catalog, quarterly/yearly billing intervals, recurring
 * credit grants, and one-time pack prices loaded from environment variables.
 */

export const PLAN_TIERS = ["starter", "growth", "scale"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
export const FREE_CREDITS = 50;
export const BILLING_INTERVALS = ["quarterly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export type ProductLine = "avelero" | "impact";

export interface TierPrices {
  avelero: string;
  impact: string;
}

export interface TierConfig {
  creditsPerQuarter: number;
  creditsPerYear: number;
  variantGlobalCap: number;
  prices: Record<BillingInterval, TierPrices>;
}

/**
 * Reads a Stripe recurring price ID for the configured billing interval.
 */
function readIntervalPriceId(envName: string): string {
  return process.env[envName] ?? "";
}

export const PACK_SIZES = [100, 250, 500, 1_000, 2_500, 5_000] as const;
export type PackSize = (typeof PACK_SIZES)[number];

export interface PackConfig {
  credits: number;
  priceCents: number;
}

export const PACK_CONFIG: Record<PackSize, PackConfig> = {
  100: { credits: 100, priceCents: 55_000 },
  250: { credits: 250, priceCents: 125_000 },
  500: { credits: 500, priceCents: 200_000 },
  1000: { credits: 1_000, priceCents: 350_000 },
  2500: { credits: 2_500, priceCents: 750_000 },
  5000: { credits: 5_000, priceCents: 1_250_000 },
};

export const ONBOARDING_DISCOUNT_FACTOR = 0.5;

export const PACK_PRICE_IDS: Record<PackSize, string> = {
  100: process.env.STRIPE_PRICE_ID_PACK_100 ?? "",
  250: process.env.STRIPE_PRICE_ID_PACK_250 ?? "",
  500: process.env.STRIPE_PRICE_ID_PACK_500 ?? "",
  1000: process.env.STRIPE_PRICE_ID_PACK_1000 ?? "",
  2500: process.env.STRIPE_PRICE_ID_PACK_2500 ?? "",
  5000: process.env.STRIPE_PRICE_ID_PACK_5000 ?? "",
};

export const TIER_CONFIG: Record<PlanTier, TierConfig> = {
  starter: {
    creditsPerQuarter: 125,
    creditsPerYear: 500,
    variantGlobalCap: 50_000,
    prices: {
      quarterly: {
        avelero: readIntervalPriceId("STRIPE_PRICE_ID_AVELERO_STARTER_QUARTERLY"),
        impact: readIntervalPriceId("STRIPE_PRICE_ID_IMPACT_STARTER_QUARTERLY"),
      },
      yearly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_STARTER_YEARLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_STARTER_YEARLY!,
      },
    },
  },
  growth: {
    creditsPerQuarter: 500,
    creditsPerYear: 2_000,
    variantGlobalCap: 250_000,
    prices: {
      quarterly: {
        avelero: readIntervalPriceId("STRIPE_PRICE_ID_AVELERO_GROWTH_QUARTERLY"),
        impact: readIntervalPriceId("STRIPE_PRICE_ID_IMPACT_GROWTH_QUARTERLY"),
      },
      yearly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_GROWTH_YEARLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_GROWTH_YEARLY!,
      },
    },
  },
  scale: {
    creditsPerQuarter: 2_500,
    creditsPerYear: 10_000,
    variantGlobalCap: 1_000_000,
    prices: {
      quarterly: {
        avelero: readIntervalPriceId("STRIPE_PRICE_ID_AVELERO_SCALE_QUARTERLY"),
        impact: readIntervalPriceId("STRIPE_PRICE_ID_IMPACT_SCALE_QUARTERLY"),
      },
      yearly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_SCALE_YEARLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_SCALE_YEARLY!,
      },
    },
  },
};

/**
 * Euro amounts in cents per tier and interval (Avelero base subscription only).
 * Used to classify plan changes as upgrades vs downgrades.
 */
export const TIER_AMOUNTS: Record<PlanTier, Record<BillingInterval, number>> = {
  starter: { quarterly: 75_000, yearly: 270_000 },
  growth: { quarterly: 195_000, yearly: 702_000 },
  scale: { quarterly: 375_000, yearly: 1_350_000 },
};

const TIER_ORDER: Record<PlanTier, number> = {
  starter: 0,
  growth: 1,
  scale: 2,
};

/**
 * Determines whether a plan change is an upgrade (requires immediate payment)
 * or a downgrade (credit deferred to the next invoice).
 *
 * Quarterly → yearly on the same or higher tier is always treated as an
 * upgrade because the customer commits to a larger upfront payment.
 */
export function isUpgradeChange(params: {
  currentTier: PlanTier;
  currentInterval: BillingInterval;
  newTier: PlanTier;
  newInterval: BillingInterval;
}): boolean {
  const { currentTier, newTier } = params;

  // A downgrade is strictly moving to a lower tier. Everything else
  // (same tier with interval change, or higher tier) is an upgrade.
  return TIER_ORDER[newTier] >= TIER_ORDER[currentTier];
}

/**
 * Resolves the credit grant for a successful plan payment.
 */
export function creditsForPayment(
  tier: PlanTier,
  interval: BillingInterval,
): number {
  const config = TIER_CONFIG[tier];
  return interval === "quarterly" ? config.creditsPerQuarter : config.creditsPerYear;
}

/**
 * Fails fast when a required Stripe price ID is missing from the environment.
 */
export function assertPriceIdsConfigured(): void {
  for (const [tier, config] of Object.entries(TIER_CONFIG)) {
    for (const [interval, prices] of Object.entries(config.prices)) {
      if (!prices.avelero) {
        throw new Error(
          `Missing STRIPE_PRICE_ID_AVELERO_${tier.toUpperCase()}_${interval.toUpperCase()}`,
        );
      }

      if (!prices.impact) {
        throw new Error(
          `Missing STRIPE_PRICE_ID_IMPACT_${tier.toUpperCase()}_${interval.toUpperCase()}`,
        );
      }
    }
  }
}

/**
 * Normalizes stored or inbound billing interval values.
 */
export function normalizeBillingInterval(
  value: string | null | undefined,
): BillingInterval | null {
  if (value === "quarterly") {
    return "quarterly";
  }

  if (value === "yearly") {
    return "yearly";
  }

  return null;
}

/**
 * Checks whether an arbitrary metadata value is a supported billing tier.
 */
export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && PLAN_TIERS.includes(value as PlanTier);
}

/**
 * Checks whether an arbitrary metadata value is a supported billing interval.
 */
export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && BILLING_INTERVALS.includes(value as BillingInterval);
}

/**
 * Reverse-lookup: given a Stripe Price ID, determine the tier, product line,
 * and billing interval it belongs to.
 *
 * Used by webhook handlers to interpret subscription items from Stripe events.
 */
export function resolvePriceId(priceId: string): {
  tier: PlanTier;
  product: ProductLine;
  interval: BillingInterval;
} | null {
  if (typeof priceId !== "string" || priceId.length === 0) {
    return null;
  }

  for (const [tier, config] of Object.entries(TIER_CONFIG)) {
    for (const [interval, prices] of Object.entries(config.prices)) {
      if (prices.avelero && prices.avelero === priceId) {
        return {
          tier: tier as PlanTier,
          product: "avelero",
          interval: interval as BillingInterval,
        };
      }
      if (prices.impact && prices.impact === priceId) {
        return {
          tier: tier as PlanTier,
          product: "impact",
          interval: interval as BillingInterval,
        };
      }
    }
  }
  return null;
}

/**
 * Resolves the configured Stripe price ID for a one-time credit pack purchase.
 */
export function getPackPriceId(packSize: PackSize): string {
  const priceId = PACK_PRICE_IDS[packSize];

  if (!priceId) {
    throw new Error(`Missing STRIPE_PRICE_ID_PACK_${packSize}`);
  }

  return priceId;
}

/**
 * Reverse-looks up the configured pack size for a Stripe one-time price.
 */
export function resolvePackPriceId(priceId: string): PackSize | null {
  if (typeof priceId !== "string" || priceId.length === 0) {
    return null;
  }

  for (const [packSize, configuredPriceId] of Object.entries(PACK_PRICE_IDS)) {
    if (configuredPriceId === priceId) {
      return Number(packSize) as PackSize;
    }
  }

  return null;
}
