/**
 * Static plan feature data for the plan selector UI.
 *
 * Defines tier display info (prices, credits, descriptions) and
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
  /** Monthly-equivalent price in euros for display. null = custom (Enterprise). */
  monthlyPrice: number | null;
  /** Quarterly price in euros (total charge). null = custom. */
  quarterlyPrice: number | null;
  /** Yearly price in euros (total, not per-month). null = custom. */
  yearlyPrice: number | null;
  /** Impact Predictions monthly-equivalent add-on price. null = custom. */
  impactMonthlyPrice: number | null;
  /** Impact Predictions quarterly add-on price (total charge). null = custom. */
  impactQuarterlyPrice: number | null;
  /** Impact Predictions yearly add-on price (total). null = custom. */
  impactYearlyPrice: number | null;
  /** Credits awarded on each quarterly renewal. null = custom. */
  creditsPerQuarter: number | null;
  /** Credits awarded on each yearly renewal. null = custom. */
  creditsPerYear: number | null;
}

export interface CreditPackDisplay {
  credits: number;
  price: number;
}

export const PLAN_TIERS: PlanTier[] = ["starter", "growth", "scale"];

export const PLAN_DISPLAY: Record<PlanTier, PlanDisplay> = {
  starter: {
    name: "Starter",
    description: "For small catalogs",
    monthlyPrice: 250,
    quarterlyPrice: 750,
    yearlyPrice: 2700,
    impactMonthlyPrice: 100,
    impactQuarterlyPrice: 300,
    impactYearlyPrice: 1080,
    creditsPerQuarter: 125,
    creditsPerYear: 500,
  },
  growth: {
    name: "Growth",
    description: "For growing brands",
    monthlyPrice: 650,
    quarterlyPrice: 1950,
    yearlyPrice: 7020,
    impactMonthlyPrice: 200,
    impactQuarterlyPrice: 600,
    impactYearlyPrice: 2160,
    creditsPerQuarter: 500,
    creditsPerYear: 2000,
  },
  scale: {
    name: "Scale",
    description: "For large catalogs",
    monthlyPrice: 1250,
    quarterlyPrice: 3750,
    yearlyPrice: 13500,
    impactMonthlyPrice: 400,
    impactQuarterlyPrice: 1200,
    impactYearlyPrice: 4320,
    creditsPerQuarter: 2500,
    creditsPerYear: 10000,
  },
  enterprise: {
    name: "Enterprise",
    description: "For complex businesses",
    monthlyPrice: null,
    quarterlyPrice: null,
    yearlyPrice: null,
    impactMonthlyPrice: null,
    impactQuarterlyPrice: null,
    impactYearlyPrice: null,
    creditsPerQuarter: null,
    creditsPerYear: null,
  },
};

/** Returns plan features adapted to the selected billing interval. */
export function getPlanFeatures(
  interval: "quarterly" | "yearly",
): PlanFeature[] {
  return [
    interval === "quarterly"
      ? {
          label: "Passports per quarter",
          starter: "125",
          growth: "500",
          scale: "2,500",
          enterprise: "Custom",
        }
      : {
          label: "Passports per year",
          starter: "500",
          growth: "2,000",
          scale: "10,000",
          enterprise: "Custom",
        },
    ...SHARED_PLAN_FEATURES,
  ];
}

const SHARED_PLAN_FEATURES: PlanFeature[] = [
  {
    label: "Add-on passport packs",
    starter: "Available",
    growth: "Available",
    scale: "Available",
    enterprise: "Custom",
  },
  {
    label: "Integrations",
    starter: "1",
    growth: "3",
    scale: "5",
    enterprise: "Custom",
  },

  // Keep the shared platform capabilities visible beneath the credit rows.
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

export const CREDIT_PACKS: CreditPackDisplay[] = [
  { credits: 100, price: 550 },
  { credits: 250, price: 1250 },
  { credits: 500, price: 2000 },
  { credits: 1000, price: 3500 },
  { credits: 2500, price: 7500 },
  { credits: 5000, price: 12500 },
];

/** Format a euro-denominated price for display (e.g. 250 -> "€250"). */
export function formatPrice(euros: number): string {
  // Keep billing labels compact without pulling in Intl currency formatting everywhere.
  return `€${euros.toLocaleString("en-US")}`;
}

/** Format a credit count for display in cards and summaries. */
export function formatCredits(credits: number): string {
  // Keep credit counts consistent across plan cards and usage panels.
  return credits.toLocaleString("en-US");
}

/** Get the effective monthly price for display when yearly is selected. */
export function getEffectiveMonthlyPrice(yearlyPrice: number): number {
  // Use a monthly-equivalent number so yearly pricing can be compared against quarterly cards.
  return Math.round(yearlyPrice / 12);
}
