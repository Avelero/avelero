/**
 * Unit Tests: Stripe config price resolution and validation.
 */
import { describe, expect, it } from "bun:test";
import {
  TIER_CONFIG,
  isBillingInterval,
  isPlanTier,
  resolvePriceId,
} from "../../../src/lib/stripe/config";

describe("resolvePriceId", () => {
  const tiers = ["starter", "growth", "scale"] as const;
  const intervals = ["monthly", "yearly"] as const;

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
    expect(isBillingInterval("monthly")).toBe(true);
    expect(isBillingInterval("yearly")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isBillingInterval("weekly")).toBe(false);
    expect(isBillingInterval("quarterly")).toBe(false);
    expect(isBillingInterval(null)).toBe(false);
  });
});

describe("TIER_CONFIG limits", () => {
  it("starter has correct limits", () => {
    expect(TIER_CONFIG.starter.skuAnnualLimit).toBe(500);
    expect(TIER_CONFIG.starter.skuOnboardingLimit).toBe(2500);
    expect(TIER_CONFIG.starter.variantGlobalCap).toBe(50000);
  });

  it("growth has correct limits", () => {
    expect(TIER_CONFIG.growth.skuAnnualLimit).toBe(2000);
    expect(TIER_CONFIG.growth.skuOnboardingLimit).toBe(10000);
    expect(TIER_CONFIG.growth.variantGlobalCap).toBe(250000);
  });

  it("scale has correct limits", () => {
    expect(TIER_CONFIG.scale.skuAnnualLimit).toBe(10000);
    expect(TIER_CONFIG.scale.skuOnboardingLimit).toBe(50000);
    expect(TIER_CONFIG.scale.variantGlobalCap).toBe(1000000);
  });
});
