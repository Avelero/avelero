/**
 * Product × Tier × Interval price mapping.
 *
 * Maps plan tiers to their Stripe Price IDs (for both Avelero and Impact
 * Predictions) and SKU budget limits. All 12 Price IDs are loaded from
 * environment variables.
 */

export const PLAN_TIERS = ["starter", "growth", "scale"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export type ProductLine = "avelero" | "impact";

export interface TierPrices {
  avelero: string;
  impact: string;
}

export interface TierConfig {
  skuAnnualLimit: number;
  skuOnboardingLimit: number;
  prices: Record<BillingInterval, TierPrices>;
}

export const TIER_CONFIG: Record<PlanTier, TierConfig> = {
  starter: {
    skuAnnualLimit: 500,
    skuOnboardingLimit: 2_500,
    prices: {
      monthly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_STARTER_MONTHLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_STARTER_MONTHLY!,
      },
      yearly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_STARTER_YEARLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_STARTER_YEARLY!,
      },
    },
  },
  growth: {
    skuAnnualLimit: 2_000,
    skuOnboardingLimit: 10_000,
    prices: {
      monthly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_GROWTH_MONTHLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_GROWTH_MONTHLY!,
      },
      yearly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_GROWTH_YEARLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_GROWTH_YEARLY!,
      },
    },
  },
  scale: {
    skuAnnualLimit: 10_000,
    skuOnboardingLimit: 50_000,
    prices: {
      monthly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_SCALE_MONTHLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_SCALE_MONTHLY!,
      },
      yearly: {
        avelero: process.env.STRIPE_PRICE_ID_AVELERO_SCALE_YEARLY!,
        impact: process.env.STRIPE_PRICE_ID_IMPACT_SCALE_YEARLY!,
      },
    },
  },
};

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
 * Checks whether an arbitrary metadata value is a supported billing tier.
 */
export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && PLAN_TIERS.includes(value as PlanTier);
}

/**
 * Checks whether an arbitrary metadata value is a supported billing interval.
 */
export function isBillingInterval(value: unknown): value is BillingInterval {
  return (
    typeof value === "string" &&
    BILLING_INTERVALS.includes(value as BillingInterval)
  );
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
  for (const [tier, config] of Object.entries(TIER_CONFIG)) {
    for (const [interval, prices] of Object.entries(config.prices)) {
      if (prices.avelero === priceId) {
        return {
          tier: tier as PlanTier,
          product: "avelero",
          interval: interval as BillingInterval,
        };
      }
      if (prices.impact === priceId) {
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
