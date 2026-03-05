/**
 * Shared percentage conversion and validation utilities for form hooks.
 */

export const PERCENTAGE_SCALE = 100;
export const MAX_PERCENTAGE_UNITS = 100 * PERCENTAGE_SCALE;

function clampToInteger(value: number): number {
  // Round percentage-unit values to stable integers for deterministic totals.
  return Math.round(value);
}

export function toPercentageUnits(value: number): number {
  // Convert percentages to integer hundredths to avoid floating-point drift.
  if (!Number.isFinite(value)) return 0;
  return clampToInteger((value + Number.EPSILON) * PERCENTAGE_SCALE);
}

export function formatPercentageFromUnits(units: number): string {
  // Format integer hundredths back to a clean percentage string.
  return (units / PERCENTAGE_SCALE).toFixed(2).replace(/\.?0+$/, "");
}

export function isPercentageWithinBounds(value: number): boolean {
  // Validate raw percentage values before any rounding occurs.
  return Number.isFinite(value) && value >= 0 && value <= 100;
}
