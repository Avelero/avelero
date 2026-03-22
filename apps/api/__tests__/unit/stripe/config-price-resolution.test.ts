/**
 * Unit Tests: Stripe config price resolution and validation.
 */
import { describe, expect, it } from "bun:test";
import {
  FREE_CREDITS,
  PACK_CONFIG,
  TIER_CONFIG,
  assertPriceIdsConfigured,
  creditsForPayment,
  isBillingInterval,
  isPlanTier,
  resolvePackPriceId,
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
    expect(TIER_CONFIG.starter.creditsPerQuarter).toBe(125);
    expect(TIER_CONFIG.starter.creditsPerYear).toBe(500);
    expect(TIER_CONFIG.starter.variantGlobalCap).toBe(50000);
  });

  it("growth has correct limits", () => {
    expect(TIER_CONFIG.growth.creditsPerQuarter).toBe(500);
    expect(TIER_CONFIG.growth.creditsPerYear).toBe(2000);
    expect(TIER_CONFIG.growth.variantGlobalCap).toBe(250000);
  });

  it("scale has correct limits", () => {
    expect(TIER_CONFIG.scale.creditsPerQuarter).toBe(2500);
    expect(TIER_CONFIG.scale.creditsPerYear).toBe(10000);
    expect(TIER_CONFIG.scale.variantGlobalCap).toBe(1000000);
  });
});

describe("creditsForPayment", () => {
  it("returns the configured quarterly or yearly credit grants", () => {
    expect(creditsForPayment("starter", "quarterly")).toBe(125);
    expect(creditsForPayment("growth", "yearly")).toBe(2000);
  });
});

describe("PACK_CONFIG", () => {
  it("defines the expected pack catalog", () => {
    expect(PACK_CONFIG[100].priceCents).toBe(55_000);
    expect(PACK_CONFIG[5000].credits).toBe(5_000);
  });

  it("reverse-resolves configured pack price IDs", () => {
    expect(resolvePackPriceId(process.env.STRIPE_PRICE_ID_PACK_500!)).toBe(500);
    expect(resolvePackPriceId("price_unknown_pack")).toBeNull();
  });
});
