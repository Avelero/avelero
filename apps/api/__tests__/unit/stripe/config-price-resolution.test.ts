/**
 * Unit Tests: Stripe config price resolution and validation.
 */
import "../../setup-env";

import { describe, expect, it } from "bun:test";
import {
  FREE_CREDITS,
  ONBOARDING_DISCOUNT_CAP,
  PASSPORTS_PRICE_IDS,
  TIER_AMOUNTS,
  TOPUP_QUICK_AMOUNTS,
  TOPUP_RATES,
  TIER_CONFIG,
  assertPriceIdsConfigured,
  creditsForPayment,
  getPassportsPriceId,
  isBillingInterval,
  isUpgradeChange,
  isPlanTier,
  resolvePassportsPriceId,
  resolvePriceId,
} from "../../../src/lib/stripe/config";

describe("resolvePriceId", () => {
  it("requires the Stripe test price catalog to be configured", () => {
    expect(() => assertPriceIdsConfigured()).not.toThrow();
  });

  const tiers = ["starter", "growth", "scale"] as const;
  const intervals = ["quarterly", "yearly"] as const;

  for (const tier of tiers) {
    for (const interval of intervals) {
      it(`resolves avelero ${tier}/${interval}`, () => {
        const priceId = TIER_CONFIG[tier].prices[interval].avelero;
        const result = resolvePriceId(priceId);
        expect(result).toEqual({ tier, product: "avelero", interval });
      });

      it(`resolves impact ${tier}/${interval}`, () => {
        const priceId = TIER_CONFIG[tier].prices[interval].impact;
        const result = resolvePriceId(priceId);
        expect(result).toEqual({ tier, product: "impact", interval });
      });
    }
  }

  it("returns null for unknown price ID", () => {
    expect(resolvePriceId("price_unknown_123")).toBeNull();
  });
});

describe("isPlanTier", () => {
  it("accepts valid tiers", () => {
    expect(isPlanTier("starter")).toBe(true);
    expect(isPlanTier("growth")).toBe(true);
    expect(isPlanTier("scale")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isPlanTier("enterprise")).toBe(false);
    expect(isPlanTier("free")).toBe(false);
    expect(isPlanTier(123)).toBe(false);
    expect(isPlanTier(null)).toBe(false);
  });
});

describe("isBillingInterval", () => {
  it("accepts valid intervals", () => {
    expect(isBillingInterval("quarterly")).toBe(true);
    expect(isBillingInterval("yearly")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isBillingInterval("monthly")).toBe(false);
    expect(isBillingInterval("weekly")).toBe(false);
    expect(isBillingInterval(null)).toBe(false);
  });
});

describe("TIER_CONFIG limits", () => {
  it("starter has correct limits", () => {
    expect(FREE_CREDITS).toBe(50);
    expect(TIER_CONFIG.starter.creditsPerQuarter).toBe(400);
    expect(TIER_CONFIG.starter.creditsPerYear).toBe(1600);
    expect(TIER_CONFIG.starter.variantGlobalCap).toBe(50000);
  });

  it("growth has correct limits", () => {
    expect(TIER_CONFIG.growth.creditsPerQuarter).toBe(1200);
    expect(TIER_CONFIG.growth.creditsPerYear).toBe(4800);
    expect(TIER_CONFIG.growth.variantGlobalCap).toBe(250000);
  });

  it("scale has correct limits", () => {
    expect(TIER_CONFIG.scale.creditsPerQuarter).toBe(4000);
    expect(TIER_CONFIG.scale.creditsPerYear).toBe(16000);
    expect(TIER_CONFIG.scale.variantGlobalCap).toBe(1000000);
  });
});

describe("creditsForPayment", () => {
  it("returns the configured quarterly or yearly credit grants", () => {
    expect(creditsForPayment("starter", "quarterly")).toBe(400);
    expect(creditsForPayment("starter", "yearly")).toBe(1600);
    expect(creditsForPayment("growth", "quarterly")).toBe(1200);
    expect(creditsForPayment("growth", "yearly")).toBe(4800);
    expect(creditsForPayment("scale", "quarterly")).toBe(4000);
    expect(creditsForPayment("scale", "yearly")).toBe(16000);
  });
});

describe("TIER_AMOUNTS", () => {
  it("uses the corrected annual billed totals", () => {
    expect(TIER_AMOUNTS.starter).toEqual({
      quarterly: 75_000,
      yearly: 254_400,
    });
    expect(TIER_AMOUNTS.growth).toEqual({
      quarterly: 195_000,
      yearly: 662_400,
    });
    expect(TIER_AMOUNTS.scale).toEqual({
      quarterly: 555_000,
      yearly: 1_886_400,
    });
  });
});

describe("isUpgradeChange", () => {
  it("treats same-tier quarterly to yearly as an upgrade", () => {
    expect(
      isUpgradeChange({
        currentTier: "starter",
        currentInterval: "quarterly",
        newTier: "starter",
        newInterval: "yearly",
      }),
    ).toBe(true);
  });

  it("treats same-tier yearly to quarterly as a downgrade", () => {
    expect(
      isUpgradeChange({
        currentTier: "starter",
        currentInterval: "yearly",
        newTier: "starter",
        newInterval: "quarterly",
      }),
    ).toBe(false);
  });

  it("treats higher tiers as upgrades regardless of interval", () => {
    expect(
      isUpgradeChange({
        currentTier: "starter",
        currentInterval: "yearly",
        newTier: "growth",
        newInterval: "quarterly",
      }),
    ).toBe(true);
    expect(
      isUpgradeChange({
        currentTier: "growth",
        currentInterval: "quarterly",
        newTier: "scale",
        newInterval: "quarterly",
      }),
    ).toBe(true);
  });

  it("does not treat same-tier or lower-tier no-op changes as upgrades", () => {
    expect(
      isUpgradeChange({
        currentTier: "growth",
        currentInterval: "quarterly",
        newTier: "growth",
        newInterval: "quarterly",
      }),
    ).toBe(false);
    expect(
      isUpgradeChange({
        currentTier: "scale",
        currentInterval: "yearly",
        newTier: "growth",
        newInterval: "yearly",
      }),
    ).toBe(false);
  });
});

describe("top-up pricing", () => {
  it("defines the expected tier-based rate catalog", () => {
    expect(TOPUP_RATES.starter).toBe(250);
    expect(TOPUP_RATES.growth).toBe(200);
    expect(TOPUP_RATES.scale).toBe(175);
  });

  it("defines the expected onboarding discount caps and quick amounts", () => {
    expect(ONBOARDING_DISCOUNT_CAP.starter).toBe(4800);
    expect(ONBOARDING_DISCOUNT_CAP.growth).toBe(14400);
    expect(ONBOARDING_DISCOUNT_CAP.scale).toBe(48000);
    expect(TOPUP_QUICK_AMOUNTS.starter).toEqual([100, 200, 400]);
    expect(TOPUP_QUICK_AMOUNTS.growth).toEqual([300, 600, 1_200]);
    expect(TOPUP_QUICK_AMOUNTS.scale).toEqual([1_000, 2_000, 4_000]);
  });

  it("resolves configured per-tier passports price IDs", () => {
    expect(getPassportsPriceId("starter")).toBe(PASSPORTS_PRICE_IDS.starter);
    expect(resolvePassportsPriceId(process.env.STRIPE_PRICE_ID_PASSPORTS_SCALE!)).toBe("scale");
    expect(resolvePassportsPriceId("price_unknown_topup")).toBeNull();
  });
});
