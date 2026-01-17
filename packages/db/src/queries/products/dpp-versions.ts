/**
 * DPP Version operations.
 *
 * Manages product_passport_versions records - the immutable version history.
 * Each publish action creates a new version; versions are NEVER updated or deleted.
 */

import { and, asc, desc, eq, max, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Database } from "../../client";
import { productPassportVersions } from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

/**
 * The JSON-LD snapshot structure for a DPP version.
 * This matches the structure defined in immutable-passports-plan.md Section 3.
 */
export interface DppSnapshot {
  "@context": {
    "@vocab": string;
    dpp: string;
    espr: string;
  };
  "@type": string;
  "@id": string;
  productIdentifiers: {
    upid: string;
    sku: string | null;
    barcode: string | null;
  };
  productAttributes: {
    name: string;
    description: string | null;
    image: string | null;
    category: string | null;
    manufacturer: {
      name: string;
      legalName: string | null;
      email: string | null;
      phone: string | null;
      website: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      countryCode: string | null;
    } | null;
    attributes: Array<{ name: string; value: string }>;
    weight: { value: number; unit: string } | null;
  };
  environmental: {
    waterLiters: { value: number; unit: string } | null;
    carbonKgCo2e: { value: number; unit: string } | null;
  } | null;
  materials: {
    composition: Array<{
      material: string;
      percentage: number | null;
      recyclable: boolean | null;
      countryOfOrigin: string | null;
      certification: {
        title: string;
        certificationCode: string | null;
        testingInstitute: {
          instituteName: string | null;
          instituteEmail: string | null;
          instituteWebsite: string | null;
          instituteAddressLine1: string | null;
          instituteAddressLine2: string | null;
          instituteCity: string | null;
          instituteState: string | null;
          instituteZip: string | null;
          instituteCountryCode: string | null;
        } | null;
      } | null;
    }>;
  } | null;
  supplyChain: Array<{
    stepType: string;
    sortIndex: number;
    operators: Array<{
      displayName: string;
      legalName: string | null;
      email: string | null;
      phone: string | null;
      website: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      countryCode: string | null;
    }>;
  }>;
  metadata: {
    schemaVersion: string;
    publishedAt: string;
    versionNumber: number;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate SHA-256 hash of the canonical JSON representation.
 * Used for integrity verification and detecting content changes.
 *
 * @param data - The data to hash
 * @returns SHA-256 hash as hex string
 */
function calculateContentHash(data: unknown): string {
  // Use canonical JSON (sorted keys) for consistent hashing
  const canonicalJson = JSON.stringify(
    data,
    Object.keys(data as object).sort(),
  );
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

// =============================================================================
// CREATE OPERATIONS
// =============================================================================

/**
 * Create a new DPP version record.
 *
 * @param db - Database instance
 * @param passportId - The passport this version belongs to
 * @param dataSnapshot - The complete JSON-LD snapshot
 * @param schemaVersion - The schema version (e.g., "1.0")
 * @returns The created version record
 */
export async function createDppVersion(
  db: Database,
  passportId: string,
  dataSnapshot: DppSnapshot,
  schemaVersion: string = "1.0",
) {
  // Get the next version number for this passport
  const [result] = await db
    .select({
      maxVersion: max(productPassportVersions.versionNumber),
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.passportId, passportId));

  const nextVersionNumber = (result?.maxVersion ?? 0) + 1;

  // Update the snapshot metadata with the actual version number
  const snapshotWithMetadata: DppSnapshot = {
    ...dataSnapshot,
    metadata: {
      ...dataSnapshot.metadata,
      versionNumber: nextVersionNumber,
      publishedAt: new Date().toISOString(),
      schemaVersion,
    },
  };

  // Calculate content hash
  const contentHash = calculateContentHash(snapshotWithMetadata);

  // Insert the version record
  const [version] = await db
    .insert(productPassportVersions)
    .values({
      passportId,
      versionNumber: nextVersionNumber,
      dataSnapshot: snapshotWithMetadata,
      contentHash,
      schemaVersion,
    })
    .returning({
      id: productPassportVersions.id,
      passportId: productPassportVersions.passportId,
      versionNumber: productPassportVersions.versionNumber,
      dataSnapshot: productPassportVersions.dataSnapshot,
      contentHash: productPassportVersions.contentHash,
      schemaVersion: productPassportVersions.schemaVersion,
      publishedAt: productPassportVersions.publishedAt,
    });

  return version;
}

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Get the latest (current) version for a passport.
 *
 * @param db - Database instance
 * @param passportId - The passport ID
 * @returns The latest version, or null if none exist
 */
export async function getLatestVersion(db: Database, passportId: string) {
  const [version] = await db
    .select({
      id: productPassportVersions.id,
      passportId: productPassportVersions.passportId,
      versionNumber: productPassportVersions.versionNumber,
      dataSnapshot: productPassportVersions.dataSnapshot,
      contentHash: productPassportVersions.contentHash,
      schemaVersion: productPassportVersions.schemaVersion,
      publishedAt: productPassportVersions.publishedAt,
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.passportId, passportId))
    .orderBy(desc(productPassportVersions.versionNumber))
    .limit(1);

  return version ?? null;
}

/**
 * Get a specific version by ID.
 *
 * @param db - Database instance
 * @param versionId - The version ID
 * @returns The version, or null if not found
 */
export async function getVersionById(db: Database, versionId: string) {
  const [version] = await db
    .select({
      id: productPassportVersions.id,
      passportId: productPassportVersions.passportId,
      versionNumber: productPassportVersions.versionNumber,
      dataSnapshot: productPassportVersions.dataSnapshot,
      contentHash: productPassportVersions.contentHash,
      schemaVersion: productPassportVersions.schemaVersion,
      publishedAt: productPassportVersions.publishedAt,
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.id, versionId))
    .limit(1);

  return version ?? null;
}

/**
 * Get a specific version by passport ID and version number.
 *
 * @param db - Database instance
 * @param passportId - The passport ID
 * @param versionNumber - The version number
 * @returns The version, or null if not found
 */
export async function getVersionByNumber(
  db: Database,
  passportId: string,
  versionNumber: number,
) {
  const [version] = await db
    .select({
      id: productPassportVersions.id,
      passportId: productPassportVersions.passportId,
      versionNumber: productPassportVersions.versionNumber,
      dataSnapshot: productPassportVersions.dataSnapshot,
      contentHash: productPassportVersions.contentHash,
      schemaVersion: productPassportVersions.schemaVersion,
      publishedAt: productPassportVersions.publishedAt,
    })
    .from(productPassportVersions)
    .where(
      and(
        eq(productPassportVersions.passportId, passportId),
        eq(productPassportVersions.versionNumber, versionNumber),
      ),
    )
    .limit(1);

  return version ?? null;
}

/**
 * Get all versions for a passport (for audit UI / version history).
 *
 * @param db - Database instance
 * @param passportId - The passport ID
 * @returns Array of versions in descending order (newest first)
 */
export async function getVersionHistory(db: Database, passportId: string) {
  const versions = await db
    .select({
      id: productPassportVersions.id,
      passportId: productPassportVersions.passportId,
      versionNumber: productPassportVersions.versionNumber,
      contentHash: productPassportVersions.contentHash,
      schemaVersion: productPassportVersions.schemaVersion,
      publishedAt: productPassportVersions.publishedAt,
      // Omit dataSnapshot for performance - use getVersionById when needed
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.passportId, passportId))
    .orderBy(desc(productPassportVersions.versionNumber));

  return versions;
}

/**
 * Get the total number of versions for a passport.
 *
 * @param db - Database instance
 * @param passportId - The passport ID
 * @returns The count of versions
 */
export async function getVersionCount(db: Database, passportId: string) {
  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.passportId, passportId));

  return result?.count ?? 0;
}

// =============================================================================
// VERIFICATION
// =============================================================================

/**
 * Verify the integrity of a version's data snapshot.
 *
 * @param db - Database instance
 * @param versionId - The version ID to verify
 * @returns True if the content hash matches, false otherwise
 */
export async function verifyVersionIntegrity(
  db: Database,
  versionId: string,
): Promise<boolean> {
  const version = await getVersionById(db, versionId);
  if (!version) {
    return false;
  }

  const calculatedHash = calculateContentHash(version.dataSnapshot);
  return calculatedHash === version.contentHash;
}
