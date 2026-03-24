/**
 * Verifies Stripe subscription scheduling helpers that compute future phase boundaries.
 */
import { describe, expect, it } from "bun:test";
import { resolveScheduledPhaseEndDate } from "../../../src/lib/stripe/subscription";

describe("resolveScheduledPhaseEndDate", () => {
  it("clamps quarterly month-end renewals to the last day of the target month", () => {
    const startDate = Date.UTC(2024, 0, 31, 0, 0, 0, 0) / 1000;

    expect(resolveScheduledPhaseEndDate(startDate, "quarterly")).toBe(
      Date.UTC(2024, 3, 30, 0, 0, 0, 0) / 1000,
    );
  });

  it("clamps yearly leap-day renewals to February 28 in non-leap years", () => {
    const startDate = Date.UTC(2024, 1, 29, 12, 30, 0, 0) / 1000;

    expect(resolveScheduledPhaseEndDate(startDate, "yearly")).toBe(
      Date.UTC(2025, 1, 28, 12, 30, 0, 0) / 1000,
    );
  });

  it("preserves standard quarterly billing dates when no clamping is needed", () => {
    const startDate = Date.UTC(2024, 2, 15, 8, 45, 0, 0) / 1000;

    expect(resolveScheduledPhaseEndDate(startDate, "quarterly")).toBe(
      Date.UTC(2024, 5, 15, 8, 45, 0, 0) / 1000,
    );
  });
});
