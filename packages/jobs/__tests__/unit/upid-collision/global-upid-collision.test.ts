/**
 * Unit Tests: Global UPID Collision Detection
 *
 * Verifies collision logic used by import validation to block UPIDs that are
 * already claimed by live variants.
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
    // Build an empty claim map so unknown UPIDs remain available.
    const claims = buildUpidClaimMap([]);

    expect(hasGlobalUpidConflict(claims.get("MISSING-UPID"), null)).toBe(false);
  });

  it("returns false when UPID belongs to the same existing variant", () => {
    // Treat the current variant as the only valid owner of its existing UPID.
    const claims = buildUpidClaimMap([{ id: "variant-1", upid: "UPID-001" }]);

    expect(hasGlobalUpidConflict(claims.get("UPID-001"), "variant-1")).toBe(
      false,
    );
  });

  it("returns true when UPID is used by a different variant", () => {
    // Block reuse when another live variant already owns the UPID.
    const claims = buildUpidClaimMap([{ id: "variant-a", upid: "UPID-001" }]);

    expect(hasGlobalUpidConflict(claims.get("UPID-001"), "variant-b")).toBe(
      true,
    );
  });

  it("ignores blank and null UPIDs when building claims", () => {
    // Skip unusable identifiers so the claim map only tracks real live UPIDs.
    const claims = buildUpidClaimMap([
      { id: "variant-null", upid: null },
      { id: "variant-blank", upid: "" },
      { id: "variant-space", upid: "   " },
    ]);

    expect(claims.size).toBe(0);
    expect(hasGlobalUpidConflict(claims.get("UPID-ORPHAN"), null)).toBe(false);
  });
});
