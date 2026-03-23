/**
 * Static plan feature data for the plan selector UI.
 *
 * Defines tier display info (prices, credits, descriptions) and
 * the feature comparison list used in plan cards.
 */

export type PlanTier = "starter" | "growth" | "scale" | "enterprise";
export type PaidPlanTier = Exclude<PlanTier, "enterprise">;

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

export const PLAN_TIERS: PaidPlanTier[] = ["starter", "growth", "scale"];

export const PLAN_DISPLAY: Record<PlanTier, PlanDisplay> = {
  starter: {
    name: "Starter",
    description: "For small catalogs",
    monthlyPrice: 250,
    quarterlyPrice: 750,
    yearlyPrice: 2544,
    impactMonthlyPrice: 100,
    impactQuarterlyPrice: 300,
    impactYearlyPrice: 1080,
    creditsPerQuarter: 400,
    creditsPerYear: 1600,
  },
  growth: {
    name: "Growth",
    description: "For growing brands",
    monthlyPrice: 650,
    quarterlyPrice: 1950,
    yearlyPrice: 6624,
    impactMonthlyPrice: 200,
    impactQuarterlyPrice: 600,
    impactYearlyPrice: 2160,
    creditsPerQuarter: 1200,
    creditsPerYear: 4800,
  },
  scale: {
    name: "Scale",
    description: "For large catalogs",
    monthlyPrice: 1850,
    quarterlyPrice: 5550,
    yearlyPrice: 18864,
    impactMonthlyPrice: 400,
    impactQuarterlyPrice: 1200,
    impactYearlyPrice: 4320,
    creditsPerQuarter: 4000,
    creditsPerYear: 16000,
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
    buildCreditAllowanceFeature(interval),
    ...getSharedPlanFeatures(),
  ];
}

export const TOPUP_RATES: Record<PaidPlanTier, number> = {
  starter: 2.5,
  growth: 2,
  scale: 1.75,
};
export const ONBOARDING_DISCOUNT_CAP: Record<PaidPlanTier, number> = {
  starter: 4_800,
  growth: 14_400,
  scale: 48_000,
};
export const TOPUP_QUICK_AMOUNTS: Record<
  PaidPlanTier,
  readonly [number, number, number]
> = {
  starter: [100, 200, 400],
  growth: [300, 600, 1_200],
  scale: [1_000, 2_000, 4_000],
};

/** Builds the cadence-specific credit allowance row from the shared plan catalog. */
function buildCreditAllowanceFeature(
  interval: "quarterly" | "yearly",
): PlanFeature {
  // Keep the feature table aligned with the plan display catalog.
  return {
    label:
      interval === "quarterly" ? "Passports per quarter" : "Passports per year",
    starter: getPlanCreditAllowance("starter", interval),
    growth: getPlanCreditAllowance("growth", interval),
    scale: getPlanCreditAllowance("scale", interval),
    enterprise: getPlanCreditAllowance("enterprise", interval),
  };
}

/** Builds the comparison rows shared by both billing intervals. */
function getSharedPlanFeatures(): PlanFeature[] {
  // Derive shared pricing text from the top-up catalog to prevent drift.
  return [
    {
      label: "Per additional passport",
      starter: getAdditionalPassportPrice("starter"),
      growth: getAdditionalPassportPrice("growth"),
      scale: getAdditionalPassportPrice("scale"),
      enterprise: getAdditionalPassportPrice("enterprise"),
    },
    ...SHARED_PLAN_FEATURES,
  ];
}

/** Formats the included credit allowance for the selected plan cadence. */
function getPlanCreditAllowance(
  tier: PlanTier,
  interval: "quarterly" | "yearly",
): string {
  // Enterprise stays custom while paid plans read their allowances from PLAN_DISPLAY.
  const display = PLAN_DISPLAY[tier];
  const credits =
    interval === "quarterly" ? display.creditsPerQuarter : display.creditsPerYear;

  return credits == null ? "Custom" : formatCredits(credits);
}

/** Formats the per-passport top-up rate for the feature table. */
function getAdditionalPassportPrice(tier: PlanTier): string {
  // Enterprise does not have a fixed per-passport top-up rate.
  if (tier === "enterprise") {
    return "Custom";
  }

  return formatPrice(TOPUP_RATES[tier]);
}

const SHARED_PLAN_FEATURES: PlanFeature[] = [
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

/** Format a euro-denominated price for display with cents only when needed. */
export function formatPrice(euros: number): string {
  // Preserve clean integer display for plan prices while still showing cents for per-unit top-ups.
  const hasFractionalAmount = Math.round(euros * 100) % 100 !== 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: hasFractionalAmount ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(euros);
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
