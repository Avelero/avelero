/**
 * Product × tier × interval Stripe catalog definitions.
 *
 * Maps the paid plan catalog, quarterly/yearly billing intervals, recurring
 * credit grants, and per-credit top-up prices loaded from environment variables.
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

export const ONBOARDING_DISCOUNT_FACTOR = 0.5;
export const PASSPORTS_PRICE_IDS: Record<PlanTier, string> = {
  starter: process.env.STRIPE_PRICE_ID_PASSPORTS_STARTER ?? "",
  growth: process.env.STRIPE_PRICE_ID_PASSPORTS_GROWTH ?? "",
  scale: process.env.STRIPE_PRICE_ID_PASSPORTS_SCALE ?? "",
};
export const TOPUP_RATES: Record<PlanTier, number> = {
  starter: 250,
  growth: 200,
  scale: 175,
};
export const ONBOARDING_DISCOUNT_CAP: Record<PlanTier, number> = {
  starter: 4_800,
  growth: 14_400,
  scale: 48_000,
};
export const TOPUP_QUICK_AMOUNTS: Record<PlanTier, readonly [number, number, number]> = {
  starter: [100, 200, 400],
  growth: [300, 600, 1_200],
  scale: [1_000, 2_000, 4_000],
};

export const TIER_CONFIG: Record<PlanTier, TierConfig> = {
  starter: {
    creditsPerQuarter: 400,
    creditsPerYear: 1_600,
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
    creditsPerQuarter: 1_200,
    creditsPerYear: 4_800,
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
    creditsPerQuarter: 4_000,
    creditsPerYear: 16_000,
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
  starter: { quarterly: 75_000, yearly: 254_400 },
  growth: { quarterly: 195_000, yearly: 662_400 },
  scale: { quarterly: 555_000, yearly: 1_886_400 },
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
  const { currentTier, currentInterval, newTier, newInterval } = params;
  const intervalCommitmentRank: Record<BillingInterval, number> = {
    quarterly: 0,
    yearly: 1,
  };

  if (TIER_ORDER[newTier] !== TIER_ORDER[currentTier]) {
    return TIER_ORDER[newTier] > TIER_ORDER[currentTier];
  }

  return intervalCommitmentRank[newInterval] > intervalCommitmentRank[currentInterval];
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

    if (!PASSPORTS_PRICE_IDS[tier as PlanTier]) {
      throw new Error(
        `Missing STRIPE_PRICE_ID_PASSPORTS_${tier.toUpperCase()}`,
      );
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
 * Resolves the configured Stripe price ID for a per-credit top-up purchase.
 */
export function getPassportsPriceId(tier: PlanTier): string {
  const priceId = PASSPORTS_PRICE_IDS[tier];

  if (!priceId) {
    throw new Error(`Missing STRIPE_PRICE_ID_PASSPORTS_${tier.toUpperCase()}`);
  }

  return priceId;
}

/**
 * Reverse-looks up the plan tier for a Stripe per-credit top-up price.
 */
export function resolvePassportsPriceId(priceId: string): PlanTier | null {
  if (typeof priceId !== "string" || priceId.length === 0) {
    return null;
  }

  for (const [tier, configuredPriceId] of Object.entries(PASSPORTS_PRICE_IDS)) {
    if (configuredPriceId === priceId) {
      return tier as PlanTier;
    }
  }

  return null;
}
