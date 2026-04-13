/**
 * Claim information for a single UPID.
 */
export interface UpidClaim {
  /** Variant IDs currently using this UPID in product_variants. */
  variantIds: Set<string>;
}

/**
 * UPID claim map keyed by UPID value.
 */
export type UpidClaimMap = Map<string, UpidClaim>;

/**
 * Builds a claim map from live variant query results.
 */
export function buildUpidClaimMap(
  variantRows: Array<{ id: string; upid: string | null }>,
): UpidClaimMap {
  const claims: UpidClaimMap = new Map();

  // Ensure we always mutate a single object per UPID.
  const getOrCreateClaim = (upid: string): UpidClaim => {
    const existing = claims.get(upid);
    if (existing) return existing;

    const created: UpidClaim = {
      variantIds: new Set<string>(),
    };
    claims.set(upid, created);
    return created;
  };

  for (const row of variantRows) {
    if (!row.upid || row.upid.trim() === "") continue;
    getOrCreateClaim(row.upid).variantIds.add(row.id);
  }

  return claims;
}

/**
 * Returns true when a UPID is claimed by any entity other than currentVariantId.
 */
export function hasGlobalUpidConflict(
  claim: UpidClaim | undefined,
  currentVariantId: string | null,
): boolean {
  if (!claim) return false;

  for (const variantId of claim.variantIds) {
    if (!currentVariantId || variantId !== currentVariantId) {
      return true;
    }
  }

  return false;
}
