/**
 * UPID Collision Utilities
 *
 * Helpers for detecting global UPID collisions across working variants and
 * immutable passports.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Claim information for a single UPID.
 */
export interface UpidClaim {
  /** Variant IDs currently using this UPID in product_variants. */
  variantIds: Set<string>;
  /**
   * Variant IDs linked to passports using this UPID.
   * A passport may point to NULL (orphaned), tracked separately below.
   */
  passportLinkedVariantIds: Set<string>;
  /** True when a passport with this UPID exists but is orphaned. */
  hasOrphanedPassport: boolean;
}

/**
 * UPID claim map keyed by UPID value.
 */
export type UpidClaimMap = Map<string, UpidClaim>;

// ============================================================================
// Builders
// ============================================================================

/**
 * Builds a claim map from variant and passport query results.
 */
export function buildUpidClaimMap(
  variantRows: Array<{ id: string; upid: string | null }>,
  passportRows: Array<{ upid: string; workingVariantId: string | null }>,
): UpidClaimMap {
  const claims: UpidClaimMap = new Map();

  // Ensure we always mutate a single object per UPID.
  const getOrCreateClaim = (upid: string): UpidClaim => {
    const existing = claims.get(upid);
    if (existing) return existing;

    const created: UpidClaim = {
      variantIds: new Set<string>(),
      passportLinkedVariantIds: new Set<string>(),
      hasOrphanedPassport: false,
    };
    claims.set(upid, created);
    return created;
  };

  for (const row of variantRows) {
    if (!row.upid || row.upid.trim() === "") continue;
    getOrCreateClaim(row.upid).variantIds.add(row.id);
  }

  for (const row of passportRows) {
    if (!row.upid || row.upid.trim() === "") continue;
    const claim = getOrCreateClaim(row.upid);
    if (row.workingVariantId) {
      claim.passportLinkedVariantIds.add(row.workingVariantId);
    } else {
      claim.hasOrphanedPassport = true;
    }
  }

  return claims;
}

// ============================================================================
// Checks
// ============================================================================

/**
 * Returns true when a UPID is claimed by any entity other than currentVariantId.
 */
export function hasGlobalUpidConflict(
  claim: UpidClaim | undefined,
  currentVariantId: string | null,
): boolean {
  if (!claim) return false;

  // Orphaned passports reserve the UPID globally.
  if (claim.hasOrphanedPassport) {
    return true;
  }

  for (const variantId of claim.variantIds) {
    if (!currentVariantId || variantId !== currentVariantId) {
      return true;
    }
  }

  for (const variantId of claim.passportLinkedVariantIds) {
    if (!currentVariantId || variantId !== currentVariantId) {
      return true;
    }
  }

  return false;
}
