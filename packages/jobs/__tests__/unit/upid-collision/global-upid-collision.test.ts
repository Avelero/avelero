/**
 * Unit Tests: Global UPID Collision Detection
 *
 * Verifies collision logic used by import validation to block UPIDs that are
 * already claimed globally by variants or passports.
 *
 * @module tests/unit/upid-collision/global-upid-collision
 */

import { describe, expect, it } from "bun:test";
import {
  buildUpidClaimMap,
  hasGlobalUpidConflict,
} from "../../../src/lib/upid-collision";

describe("Global UPID collision detection", () => {
  it("returns false when UPID has no claims", () => {
    const claims = buildUpidClaimMap([], []);

    expect(hasGlobalUpidConflict(claims.get("MISSING-UPID"), null)).toBe(false);
  });

  it("returns false when UPID belongs to the same existing variant", () => {
    const claims = buildUpidClaimMap(
      [{ id: "variant-1", upid: "UPID-001" }],
      [{ upid: "UPID-001", workingVariantId: "variant-1" }],
    );

    expect(hasGlobalUpidConflict(claims.get("UPID-001"), "variant-1")).toBe(
      false,
    );
  });

  it("returns true when UPID is used by a different variant", () => {
    const claims = buildUpidClaimMap(
      [{ id: "variant-a", upid: "UPID-001" }],
      [],
    );

    expect(hasGlobalUpidConflict(claims.get("UPID-001"), "variant-b")).toBe(
      true,
    );
  });

  it("returns true when UPID is reserved by an orphaned passport", () => {
    const claims = buildUpidClaimMap(
      [],
      [{ upid: "UPID-ORPHAN", workingVariantId: null }],
    );

    expect(hasGlobalUpidConflict(claims.get("UPID-ORPHAN"), null)).toBe(true);
  });
});
