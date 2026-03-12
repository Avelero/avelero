/**
 * Product × Tier × Interval price mapping.
 *
 * Maps plan tiers to their Stripe Price IDs (for both Avelero and Impact
 * Predictions) and SKU budget limits. All 12 Price IDs are loaded from
 * environment variables.
 */

export type PlanTier = "starter" | "growth" | "scale";
export type BillingInterval = "monthly" | "yearly";
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
