/**
 * DPP version operations.
 *
 * Manages immutable product_passport_versions records, including historical
 * snapshot compression for superseded versions.
 */

import { createHash } from "node:crypto";
import * as zlib from "node:zlib";
import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  max,
  ne,
  or,
} from "drizzle-orm";
import type { Database } from "../../client";
import { productPassportVersions, productPassports } from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

/**
 * The JSON-LD snapshot structure for a DPP version.
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
        issueDate: string | null;
        expiryDate: string | null;
        documentUrl: string | null;
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

/**
 * Stored passport version row shape used by query helpers.
 */
export interface StoredDppVersion {
  id: string;
  passportId: string;
  versionNumber: number;
  dataSnapshot: DppSnapshot | null;
  compressedSnapshot: Buffer | null;
  compressedAt: string | null;
  contentHash: string;
  schemaVersion: string;
  publishedAt: string;
}

/**
 * Options for batch historical version compression.
 */
export interface BatchCompressSupersededVersionsOptions {
  limit?: number;
}

/**
 * Result summary for batch historical version compression.
 */
export interface BatchCompressSupersededVersionsResult {
  scanned: number;
  compressed: number;
  skipped: number;
  versionIds: string[];
}

const ZSTD_SNAPSHOT_PREFIX = Buffer.from("dpp.zstd.v1:");
const BROTLI_SNAPSHOT_PREFIX = Buffer.from("dpp.brotli.v1:");

type SnapshotCompressionCodec = "zstd" | "brotli" | "legacy-zstd";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Recursively sort object keys for deterministic JSON serialization.
 */
function sortObjectKeys(obj: unknown): unknown {
  // Return primitives as-is.
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Recursively sort arrays.
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  // Recursively sort object keys.
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Calculate SHA-256 hash of the canonical JSON representation.
 */
function calculateContentHash(data: unknown): string {
  // Canonicalize nested objects before hashing to keep snapshots stable.
  const sortedData = sortObjectKeys(data);
  const canonicalJson = JSON.stringify(sortedData);
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

/**
 * Detect whether the active runtime supports zstd through node:zlib.
 */
function supportsZstdCompression(): boolean {
  // Gate zstd usage behind runtime feature detection to keep Node 21 imports working.
  return (
    typeof zlib.zstdCompressSync === "function" &&
    typeof zlib.zstdDecompressSync === "function"
  );
}

/**
 * Add a codec marker ahead of the compressed snapshot bytes.
 */
function encodeCompressedSnapshot(
  codec: Exclude<SnapshotCompressionCodec, "legacy-zstd">,
  payload: Buffer,
): Buffer {
  // Prefix the payload so mixed-codec environments can decode rows safely.
  return Buffer.concat([
    codec === "zstd" ? ZSTD_SNAPSHOT_PREFIX : BROTLI_SNAPSHOT_PREFIX,
    payload,
  ]);
}

/**
 * Split a stored compressed snapshot into its codec marker and payload bytes.
 */
function decodeCompressedSnapshot(compressedSnapshot: Buffer): {
  codec: SnapshotCompressionCodec;
  payload: Buffer;
} {
  // Preserve support for early rows that were written as raw zstd without a prefix.
  if (
    compressedSnapshot
      .subarray(0, ZSTD_SNAPSHOT_PREFIX.length)
      .equals(ZSTD_SNAPSHOT_PREFIX)
  ) {
    return {
      codec: "zstd",
      payload: compressedSnapshot.subarray(ZSTD_SNAPSHOT_PREFIX.length),
    };
  }

  if (
    compressedSnapshot
      .subarray(0, BROTLI_SNAPSHOT_PREFIX.length)
      .equals(BROTLI_SNAPSHOT_PREFIX)
  ) {
    return {
      codec: "brotli",
      payload: compressedSnapshot.subarray(BROTLI_SNAPSHOT_PREFIX.length),
    };
  }

  return {
    codec: "legacy-zstd",
    payload: compressedSnapshot,
  };
}

/**
 * Convert a JSON snapshot into a compressed binary form supported by the runtime.
 */
function compressSnapshotPayload(snapshot: DppSnapshot): Buffer {
  // Prefer zstd where available and fall back to brotli on older Node runtimes.
  const payload = Buffer.from(JSON.stringify(snapshot), "utf8");

  if (supportsZstdCompression()) {
    return encodeCompressedSnapshot(
      "zstd",
      Buffer.from(zlib.zstdCompressSync(payload)),
    );
  }

  return encodeCompressedSnapshot(
    "brotli",
    Buffer.from(zlib.brotliCompressSync(payload)),
  );
}

/**
 * Inflate a historical snapshot from whichever codec it was stored with.
 */
function decompressSnapshotPayload(compressedSnapshot: Buffer): DppSnapshot {
  // Read the prefixed codec so cross-runtime deployments can decode older rows.
  const { codec, payload } = decodeCompressedSnapshot(compressedSnapshot);

  if (codec === "brotli") {
    return JSON.parse(
      zlib.brotliDecompressSync(payload).toString("utf8"),
    ) as DppSnapshot;
  }

  if (!supportsZstdCompression()) {
    throw new Error(
      "Encountered a zstd-compressed passport version on a runtime without zstd support",
    );
  }

  return JSON.parse(
    zlib.zstdDecompressSync(payload).toString("utf8"),
  ) as DppSnapshot;
}

/**
 * Shared select shape for stored version rows.
 */
function versionSelection() {
  // Reuse the same selection fields across create/read/compression helpers.
  return {
    id: productPassportVersions.id,
    passportId: productPassportVersions.passportId,
    versionNumber: productPassportVersions.versionNumber,
    dataSnapshot: productPassportVersions.dataSnapshot,
    compressedSnapshot: productPassportVersions.compressedSnapshot,
    compressedAt: productPassportVersions.compressedAt,
    contentHash: productPassportVersions.contentHash,
    schemaVersion: productPassportVersions.schemaVersion,
    publishedAt: productPassportVersions.publishedAt,
  };
}

/**
 * Extract a JSON snapshot from either jsonb or compressed bytea storage.
 */
export function getVersionSnapshot(version: {
  dataSnapshot: unknown | null;
  compressedSnapshot: Buffer | null;
}): DppSnapshot | null {
  // Prefer the active jsonb payload and fall back to decompression for history.
  if (version.dataSnapshot !== null) {
    return version.dataSnapshot as DppSnapshot;
  }
  if (version.compressedSnapshot !== null) {
    return decompressSnapshotPayload(version.compressedSnapshot);
  }
  return null;
}

// =============================================================================
// CREATE OPERATIONS
// =============================================================================

/**
 * Create a new DPP version record.
 */
export async function createDppVersion(
  db: Database,
  passportId: string,
  dataSnapshot: DppSnapshot,
  schemaVersion = "1.0",
) {
  // Get the next version number for this passport.
  const [result] = await db
    .select({
      maxVersion: max(productPassportVersions.versionNumber),
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.passportId, passportId));

  const nextVersionNumber = (result?.maxVersion ?? 0) + 1;

  // Update the snapshot metadata with the actual version number.
  const snapshotWithMetadata: DppSnapshot = {
    ...dataSnapshot,
    metadata: {
      ...dataSnapshot.metadata,
      versionNumber: nextVersionNumber,
      publishedAt: new Date().toISOString(),
      schemaVersion,
    },
  };

  // Calculate content hash.
  const contentHash = calculateContentHash(snapshotWithMetadata);

  // Insert the version record with an uncompressed active snapshot.
  const [version] = await db
    .insert(productPassportVersions)
    .values({
      passportId,
      versionNumber: nextVersionNumber,
      dataSnapshot: snapshotWithMetadata,
      contentHash,
      schemaVersion,
    })
    .onConflictDoNothing({
      target: [
        productPassportVersions.passportId,
        productPassportVersions.versionNumber,
      ],
    })
    .returning(versionSelection());

  return (version as StoredDppVersion | undefined) ?? null;
}

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Get the latest (current) version for a passport.
 */
export async function getLatestVersion(
  db: Database,
  passportId: string,
): Promise<StoredDppVersion | null> {
  // Fetch the newest immutable version row for the passport.
  const [version] = await db
    .select(versionSelection())
    .from(productPassportVersions)
    .where(eq(productPassportVersions.passportId, passportId))
    .orderBy(desc(productPassportVersions.versionNumber))
    .limit(1);

  return (version as StoredDppVersion | undefined) ?? null;
}

/**
 * Compress a superseded version's JSON snapshot into bytea storage.
 */
export async function compressVersion(
  db: Database,
  versionId: string,
): Promise<StoredDppVersion | null> {
  // Load the target version so we can skip already-compressed rows.
  const [version] = await db
    .select(versionSelection())
    .from(productPassportVersions)
    .where(eq(productPassportVersions.id, versionId))
    .limit(1);

  if (!version) {
    return null;
  }
  if (version.compressedSnapshot !== null || version.dataSnapshot === null) {
    return version as StoredDppVersion;
  }

  const now = new Date().toISOString();
  const [updated] = await db
    .update(productPassportVersions)
    .set({
      compressedSnapshot: compressSnapshotPayload(
        version.dataSnapshot as DppSnapshot,
      ),
      compressedAt: now,
      dataSnapshot: null,
    })
    .where(
      and(
        eq(productPassportVersions.id, versionId),
        isNotNull(productPassportVersions.dataSnapshot),
        isNull(productPassportVersions.compressedSnapshot),
      ),
    )
    .returning(versionSelection());

  return (
    (updated as StoredDppVersion | undefined) ?? (version as StoredDppVersion)
  );
}

/**
 * Decompress and return a version's JSON snapshot.
 */
export async function decompressVersion(
  db: Database,
  versionId: string,
): Promise<DppSnapshot | null> {
  // Fetch the stored version payload and normalize it to JSON.
  const [version] = await db
    .select(versionSelection())
    .from(productPassportVersions)
    .where(eq(productPassportVersions.id, versionId))
    .limit(1);

  if (!version) {
    return null;
  }

  return getVersionSnapshot(version as StoredDppVersion);
}

/**
 * Compress superseded historical versions in small batches.
 */
export async function batchCompressSupersededVersions(
  db: Database,
  options: BatchCompressSupersededVersionsOptions = {},
): Promise<BatchCompressSupersededVersionsResult> {
  // Bound the batch size so the job can iterate safely over large histories.
  const limit = Math.max(1, options.limit ?? 500);

  const versions = (await db
    .select(versionSelection())
    .from(productPassportVersions)
    .innerJoin(
      productPassports,
      eq(productPassports.id, productPassportVersions.passportId),
    )
    .where(
      and(
        isNotNull(productPassportVersions.dataSnapshot),
        isNull(productPassportVersions.compressedSnapshot),
        or(
          isNull(productPassports.currentVersionId),
          ne(productPassportVersions.id, productPassports.currentVersionId),
        ),
      ),
    )
    .orderBy(asc(productPassportVersions.publishedAt))
    .limit(limit)) as StoredDppVersion[];

  let compressed = 0;

  for (const version of versions) {
    // Compress one superseded version at a time to keep memory bounded.
    const updated = await compressVersion(db, version.id);
    if (updated?.compressedSnapshot !== null) {
      compressed++;
    }
  }

  return {
    scanned: versions.length,
    compressed,
    skipped: versions.length - compressed,
    versionIds: versions.map((version) => version.id),
  };
}
