/**
 * Static plan feature data for the plan selector UI.
 *
 * Defines tier display info (prices, passport publish limits, descriptions) and
 * the feature comparison list used in plan cards.
 */

export type PlanTier = "starter" | "growth" | "scale" | "enterprise";

export interface PlanFeature {
  label: string;
  starter: string | boolean;
  growth: string | boolean;
  scale: string | boolean;
  enterprise: string | boolean;
}

export interface PlanDisplay {
  name: string;
  description: string;
  /** Monthly price in euros. null = custom (Enterprise). */
  monthlyPrice: number | null;
  /** Yearly price in euros (total, not per-month). null = custom. */
  yearlyPrice: number | null;
  /** Impact Predictions monthly add-on price. null = custom. */
  impactMonthlyPrice: number | null;
  /** Impact Predictions yearly add-on price (total). null = custom. */
  impactYearlyPrice: number | null;
  /** Display string for the yearly passport publish limit. */
  skuLimit: string;
  /** Whether this is the recommended plan. */
  recommended?: boolean;
}

export const PLAN_TIERS: PlanTier[] = ["starter", "growth", "scale"];

export const PLAN_DISPLAY: Record<PlanTier, PlanDisplay> = {
  starter: {
    name: "Starter",
    description: "For small catalogs",
    monthlyPrice: 250,
    yearlyPrice: 2700,
    impactMonthlyPrice: 100,
    impactYearlyPrice: 1080,
    skuLimit: "500",
  },
  growth: {
    name: "Growth",
    description: "For growing brands",
    monthlyPrice: 650,
    yearlyPrice: 7020,
    impactMonthlyPrice: 200,
    impactYearlyPrice: 2160,
    skuLimit: "2,000",
    recommended: true,
  },
  scale: {
    name: "Scale",
    description: "For large catalogs",
    monthlyPrice: 1250,
    yearlyPrice: 13500,
    impactMonthlyPrice: 400,
    impactYearlyPrice: 4320,
    skuLimit: "10,000",
  },
  enterprise: {
    name: "Enterprise",
    description: "For complex businesses",
    monthlyPrice: null,
    yearlyPrice: null,
    impactMonthlyPrice: null,
    impactYearlyPrice: null,
    skuLimit: "Unlimited",
  },
};

export const PLAN_FEATURES: PlanFeature[] = [
  // --- Scale differentiators ---
  {
    label: "New passports per year",
    starter: "500",
    growth: "2,000",
    scale: "10,000",
    enterprise: "Unlimited",
  },
  {
    label: "Year-one onboarding limit",
    starter: "2,500",
    growth: "10,000",
    scale: "50,000",
    enterprise: "Unlimited",
  },
  {
    label: "Integrations",
    starter: "1",
    growth: "3",
    scale: "5",
    enterprise: "Unlimited",
  },

  // --- Core platform features (all plans) ---
  {
    label: "Unlimited seats",
    starter: true,
    growth: true,
    scale: true,
    enterprise: true,
  },
  {
    label: "Custom domain",
    starter: true,
    growth: true,
    scale: true,
    enterprise: true,
  },
  {
    label: "Passport designer",
    starter: true,
    growth: true,
    scale: true,
    enterprise: true,
  },
  {
    label: "QR code generation",
    starter: true,
    growth: true,
    scale: true,
    enterprise: true,
  },
  {
    label: "Bulk data imports",
    starter: true,
    growth: true,
    scale: true,
    enterprise: true,
  },
  {
    label: "Compliance updates",
    starter: true,
    growth: true,
    scale: true,
    enterprise: true,
  },
  {
    label: "Certification tracking",
    starter: true,
    growth: true,
    scale: true,
    enterprise: true,
  },
  {
    label: "Custom integrations",
    starter: true,
    growth: true,
    scale: true,
    enterprise: true,
  },
];

/** Format a price for display (e.g. 250 → "€250") */
export function formatPrice(cents: number): string {
  return `€${cents.toLocaleString("en-US")}`;
}

/** Get the effective monthly price for display when yearly is selected */
export function getEffectiveMonthlyPrice(yearlyPrice: number): number {
  return Math.round(yearlyPrice / 12);
}
