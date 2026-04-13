/**
 * Batch Publish Operations.
 *
 * Provides set-based publishing for products in commit workflows.
 * This avoids per-product/per-variant publish loops by processing variants
 * in deterministic chunks with bulk reads and bulk writes.
 */

import { createHash } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandAttributeValues,
  brandAttributes,
  brandCertifications,
  brandManufacturers,
  brandMaterials,
  brandOperators,
  productEnvironment,
  productJourneySteps,
  productMaterials,
  productPassportVersions,
  productPassports,
  productVariantAttributes,
  productVariants,
  productWeight,
  products,
  taxonomyCategories,
  variantEnvironment,
  variantJourneySteps,
  variantMaterials,
  variantWeight,
} from "../../schema";
import {
  CERTIFICATIONS_BUCKET,
  buildPublicStorageUrl,
  buildProductImageUrl,
  getSupabaseUrlFromEnv,
} from "../../utils/storage-url";
import { getVersionSnapshot, type DppSnapshot } from "./dpp-versions";
import { batchCreatePassportsForVariants } from "./passports";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for set-based batch publishing.
 */
export interface PublishProductsSetBasedInput {
  brandId: string;
  productIds: string[];
  variantChunkSize?: number;
  schemaVersion?: string;
}

/**
 * Result summary for set-based batch publishing.
 */
export interface PublishProductsSetBasedResult {
  totalProductsRequested: number;
  totalProductsPublishedStatus: number;
  totalVariantsConsidered: number;
  totalVariantsSkippedNoUpid: number;
  passportsCreated: number;
  versionsCreated: number;
  versionsSkippedUnchanged: number;
}

interface VariantIdentityRow {
  variantId: string;
  productId: string;
  upid: string | null;
  sku: string | null;
  barcode: string | null;
}

interface VariantPublishTarget {
  variantId: string;
  productId: string;
  upid: string;
  passportId: string;
  currentVersionId: string | null;
}

interface CoreVariantRow {
  variantId: string;
  variantSku: string | null;
  variantBarcode: string | null;
  variantName: string | null;
  variantDescription: string | null;
  variantImagePath: string | null;
  productId: string;
  productName: string;
  productDescription: string | null;
  productImagePath: string | null;
  productCategoryId: string | null;
  productManufacturerId: string | null;
}

interface PublishVariantChunkResult {
  versionsCreated: number;
  versionsSkippedUnchanged: number;
}

interface MaterialLink {
  materialId: string;
  percentage: string | null;
}

interface JourneyRow {
  ownerId: string;
  sortIndex: number;
  stepType: string;
  operatorId: string;
}

interface EnvironmentMetrics {
  carbonKgCo2e: string | null;
  waterLiters: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_VARIANT_CHUNK_SIZE = 500;
const DEFAULT_SCHEMA_VERSION = "1.0";

// =============================================================================
// HASH HELPERS
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
 * Compute a content-only hash (metadata excluded) for deduplication.
 */
function calculateContentOnlyHash(snapshot: DppSnapshot): string {
  // Keep only content fields so metadata changes do not force new versions.
  const contentOnly = {
    "@context": snapshot["@context"],
    "@type": snapshot["@type"],
    "@id": snapshot["@id"],
    productIdentifiers: snapshot.productIdentifiers,
    productAttributes: snapshot.productAttributes,
    environmental: snapshot.environmental,
    materials: snapshot.materials,
    supplyChain: snapshot.supplyChain,
  };

  const sortedContent = sortObjectKeys(contentOnly);
  const canonicalJson = JSON.stringify(sortedContent);
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

/**
 * Compute the immutable snapshot hash used in product_passport_versions.
 */
function calculateSnapshotHash(snapshot: DppSnapshot): string {
  // Match dpp-versions create hash behavior with recursive key ordering.
  const sortedSnapshot = sortObjectKeys(snapshot);
  const canonicalJson = JSON.stringify(sortedSnapshot);
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

// =============================================================================
// GENERIC HELPERS
// =============================================================================

/**
 * Chunk a list into fixed-size slices.
 */
function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  // Return one chunk for empty input.
  if (items.length === 0) {
    return [];
  }

  // Build deterministic chunk slices.
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Parse numeric values from DB strings safely.
 */
function parseNumber(value: string | null | undefined): number | null {
  // Reject nullish values early.
  if (!value) return null;

  // Convert numeric text to number.
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

/**
 * Build environmental snapshot from metric rows.
 */
function buildEnvironmentalSnapshot(
  metrics: EnvironmentMetrics | null,
): DppSnapshot["environmental"] | null {
  // Return null when no metrics are available.
  if (!metrics) {
    return null;
  }

  return {
    carbonKgCo2e: metrics.carbonKgCo2e
      ? {
          value: Number.parseFloat(metrics.carbonKgCo2e),
          unit: "kgCO2e",
        }
      : null,
    waterLiters: metrics.waterLiters
      ? {
          value: Number.parseFloat(metrics.waterLiters),
          unit: "liters",
        }
      : null,
  };
}

/**
 * Build supply-chain snapshot rows grouped by step.
 */
function buildSupplyChainSnapshot(
  steps: JourneyRow[],
  operatorsById: Map<
    string,
    {
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
    }
  >,
): DppSnapshot["supplyChain"] {
  // Return empty list when no journey data exists.
  if (steps.length === 0) {
    return [];
  }

  // Group operators under each journey step key.
  const grouped = new Map<
    string,
    {
      stepType: string;
      sortIndex: number;
      operators: DppSnapshot["supplyChain"][0]["operators"];
    }
  >();

  for (const step of steps) {
    const operator = operatorsById.get(step.operatorId);
    if (!operator) continue;

    const key = `${step.sortIndex}:${step.stepType}`;
    const mappedOperator = {
      displayName: operator.displayName,
      legalName: operator.legalName,
      email: operator.email,
      phone: operator.phone,
      website: operator.website,
      addressLine1: operator.addressLine1,
      addressLine2: operator.addressLine2,
      city: operator.city,
      state: operator.state,
      zip: operator.zip,
      countryCode: operator.countryCode,
    };

    if (grouped.has(key)) {
      grouped.get(key)!.operators.push(mappedOperator);
    } else {
      grouped.set(key, {
        stepType: step.stepType,
        sortIndex: step.sortIndex,
        operators: [mappedOperator],
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.sortIndex - b.sortIndex);
}

/**
 * Build materials snapshot from material links.
 */
function buildMaterialsSnapshot(
  links: MaterialLink[],
  materialsById: Map<
    string,
    {
      name: string;
      recyclable: boolean | null;
      countryOfOrigin: string | null;
      certificationId: string | null;
    }
  >,
  certificationsById: Map<
    string,
    {
      title: string;
      certificationCode: string | null;
      issueDate: string | null;
      expiryDate: string | null;
      certificationPath: string | null;
      instituteName: string | null;
      instituteEmail: string | null;
      instituteWebsite: string | null;
      instituteAddressLine1: string | null;
      instituteAddressLine2: string | null;
      instituteCity: string | null;
      instituteState: string | null;
      instituteZip: string | null;
      instituteCountryCode: string | null;
    }
  >,
  storageBaseUrl: string | null | undefined,
): DppSnapshot["materials"] | null {
  // Return null when there are no links.
  if (links.length === 0) {
    return null;
  }

  // Build composition entries while preserving row order.
  const composition = links
    .map((link) => {
      const material = materialsById.get(link.materialId);
      if (!material) return null;

      const certification = material.certificationId
        ? certificationsById.get(material.certificationId)
        : null;
      const hasTestingInstituteData = certification
        ? Boolean(
            certification.instituteName ||
              certification.instituteEmail ||
              certification.instituteWebsite ||
              certification.instituteAddressLine1 ||
              certification.instituteAddressLine2 ||
              certification.instituteCity ||
              certification.instituteState ||
              certification.instituteZip ||
              certification.instituteCountryCode,
          )
        : false;

      return {
        material: material.name,
        percentage: parseNumber(link.percentage),
        recyclable: material.recyclable,
        countryOfOrigin: material.countryOfOrigin,
        certification: certification
          ? {
              title: certification.title,
              certificationCode: certification.certificationCode,
              issueDate: certification.issueDate,
              expiryDate: certification.expiryDate,
              documentUrl: buildPublicStorageUrl(
                storageBaseUrl,
                CERTIFICATIONS_BUCKET,
                certification.certificationPath,
              ),
              testingInstitute: hasTestingInstituteData
                ? {
                    instituteName: certification.instituteName,
                    instituteEmail: certification.instituteEmail,
                    instituteWebsite: certification.instituteWebsite,
                    instituteAddressLine1: certification.instituteAddressLine1,
                    instituteAddressLine2: certification.instituteAddressLine2,
                    instituteCity: certification.instituteCity,
                    instituteState: certification.instituteState,
                    instituteZip: certification.instituteZip,
                    instituteCountryCode: certification.instituteCountryCode,
                  }
                : null,
            }
          : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (composition.length === 0) {
    return null;
  }

  return { composition };
}

// =============================================================================
// SNAPSHOT BUILDING
// =============================================================================

/**
 * Build base snapshots for a variant chunk with set-based prefetching.
 */
async function buildSnapshotsForVariantChunk(
  db: Database,
  targets: VariantPublishTarget[],
): Promise<Map<string, DppSnapshot>> {
  // Return empty map for empty chunk.
  if (targets.length === 0) {
    return new Map();
  }

  const variantIds = targets.map((target) => target.variantId);
  const targetByVariantId = new Map(
    targets.map((target) => [target.variantId, target]),
  );
  const storageBaseUrl = getSupabaseUrlFromEnv();

  // Load core variant/product rows for this chunk.
  const coreRows = await db
    .select({
      variantId: productVariants.id,
      variantSku: productVariants.sku,
      variantBarcode: productVariants.barcode,
      variantName: productVariants.name,
      variantDescription: productVariants.description,
      variantImagePath: productVariants.imagePath,
      productId: products.id,
      productName: products.name,
      productDescription: products.description,
      productImagePath: products.imagePath,
      productCategoryId: products.categoryId,
      productManufacturerId: products.manufacturerId,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, variantIds));

  const productIds = [...new Set(coreRows.map((row) => row.productId))];
  const categoryIds = [
    ...new Set(
      coreRows
        .map((row) => row.productCategoryId)
        .filter((value): value is string => value !== null),
    ),
  ];
  const manufacturerIds = [
    ...new Set(
      coreRows
        .map((row) => row.productManufacturerId)
        .filter((value): value is string => value !== null),
    ),
  ];

  // Load category display names in one query.
  const categoryRows =
    categoryIds.length > 0
      ? await db
          .select({
            id: taxonomyCategories.id,
            name: taxonomyCategories.name,
          })
          .from(taxonomyCategories)
          .where(inArray(taxonomyCategories.id, categoryIds))
      : [];
  const categoryById = new Map(categoryRows.map((row) => [row.id, row.name]));

  // Load manufacturer details in one query.
  const manufacturerRows =
    manufacturerIds.length > 0
      ? await db
          .select({
            id: brandManufacturers.id,
            name: brandManufacturers.name,
            legalName: brandManufacturers.legalName,
            email: brandManufacturers.email,
            phone: brandManufacturers.phone,
            website: brandManufacturers.website,
            addressLine1: brandManufacturers.addressLine1,
            addressLine2: brandManufacturers.addressLine2,
            city: brandManufacturers.city,
            state: brandManufacturers.state,
            zip: brandManufacturers.zip,
            countryCode: brandManufacturers.countryCode,
          })
          .from(brandManufacturers)
          .where(inArray(brandManufacturers.id, manufacturerIds))
      : [];
  const manufacturerById = new Map(
    manufacturerRows.map((row) => [
      row.id,
      {
        name: row.name,
        legalName: row.legalName,
        email: row.email,
        phone: row.phone,
        website: row.website,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        state: row.state,
        zip: row.zip,
        countryCode: row.countryCode,
      },
    ]),
  );

  // Load variant attributes with names in one query.
  const attributeRows = await db
    .select({
      variantId: productVariantAttributes.variantId,
      attributeName: brandAttributes.name,
      valueName: brandAttributeValues.name,
      sortOrder: productVariantAttributes.sortOrder,
    })
    .from(productVariantAttributes)
    .innerJoin(
      brandAttributeValues,
      eq(brandAttributeValues.id, productVariantAttributes.attributeValueId),
    )
    .innerJoin(
      brandAttributes,
      eq(brandAttributes.id, brandAttributeValues.attributeId),
    )
    .where(inArray(productVariantAttributes.variantId, variantIds))
    .orderBy(
      asc(productVariantAttributes.variantId),
      asc(productVariantAttributes.sortOrder),
    );
  const attributesByVariantId = new Map<
    string,
    Array<{ name: string; value: string }>
  >();
  for (const row of attributeRows) {
    const existing = attributesByVariantId.get(row.variantId) ?? [];
    existing.push({ name: row.attributeName, value: row.valueName });
    attributesByVariantId.set(row.variantId, existing);
  }

  // Load variant and product weight rows for fallback behavior.
  const variantWeightRows = await db
    .select({
      variantId: variantWeight.variantId,
      weight: variantWeight.weight,
      weightUnit: variantWeight.weightUnit,
    })
    .from(variantWeight)
    .where(inArray(variantWeight.variantId, variantIds));
  const variantWeightByVariantId = new Map(
    variantWeightRows.map((row) => [row.variantId, row]),
  );

  const productWeightRows =
    productIds.length > 0
      ? await db
          .select({
            productId: productWeight.productId,
            weight: productWeight.weight,
            weightUnit: productWeight.weightUnit,
          })
          .from(productWeight)
          .where(inArray(productWeight.productId, productIds))
      : [];
  const productWeightByProductId = new Map(
    productWeightRows.map((row) => [row.productId, row]),
  );

  // Load variant and product environment rows for fallback behavior.
  const variantEnvironmentRows = await db
    .select({
      variantId: variantEnvironment.variantId,
      carbonKgCo2e: variantEnvironment.carbonKgCo2e,
      waterLiters: variantEnvironment.waterLiters,
    })
    .from(variantEnvironment)
    .where(inArray(variantEnvironment.variantId, variantIds));
  const variantEnvironmentByVariantId = new Map(
    variantEnvironmentRows.map((row) => [row.variantId, row]),
  );

  const productEnvironmentRows =
    productIds.length > 0
      ? await db
          .select({
            productId: productEnvironment.productId,
            metric: productEnvironment.metric,
            value: productEnvironment.value,
          })
          .from(productEnvironment)
          .where(inArray(productEnvironment.productId, productIds))
      : [];
  const productEnvironmentByProductId = new Map<string, EnvironmentMetrics>();
  for (const row of productEnvironmentRows) {
    const metrics = productEnvironmentByProductId.get(row.productId) ?? {
      carbonKgCo2e: null,
      waterLiters: null,
    };
    if (row.metric === "carbon_kg_co2e") {
      metrics.carbonKgCo2e = row.value;
    }
    if (row.metric === "water_liters") {
      metrics.waterLiters = row.value;
    }
    productEnvironmentByProductId.set(row.productId, metrics);
  }

  // Load variant and product material links for fallback behavior.
  const variantMaterialRows = await db
    .select({
      variantId: variantMaterials.variantId,
      materialId: variantMaterials.brandMaterialId,
      percentage: variantMaterials.percentage,
      createdAt: variantMaterials.createdAt,
    })
    .from(variantMaterials)
    .where(inArray(variantMaterials.variantId, variantIds))
    .orderBy(asc(variantMaterials.variantId), asc(variantMaterials.createdAt));
  const variantMaterialsByVariantId = new Map<string, MaterialLink[]>();
  for (const row of variantMaterialRows) {
    const links = variantMaterialsByVariantId.get(row.variantId) ?? [];
    links.push({ materialId: row.materialId, percentage: row.percentage });
    variantMaterialsByVariantId.set(row.variantId, links);
  }

  const productMaterialRows =
    productIds.length > 0
      ? await db
          .select({
            productId: productMaterials.productId,
            materialId: productMaterials.brandMaterialId,
            percentage: productMaterials.percentage,
            createdAt: productMaterials.createdAt,
          })
          .from(productMaterials)
          .where(inArray(productMaterials.productId, productIds))
          .orderBy(
            asc(productMaterials.productId),
            asc(productMaterials.createdAt),
          )
      : [];
  const productMaterialsByProductId = new Map<string, MaterialLink[]>();
  for (const row of productMaterialRows) {
    const links = productMaterialsByProductId.get(row.productId) ?? [];
    links.push({ materialId: row.materialId, percentage: row.percentage });
    productMaterialsByProductId.set(row.productId, links);
  }

  // Load material details and certification metadata in one set.
  const materialIds = [
    ...new Set([
      ...variantMaterialRows.map((row) => row.materialId),
      ...productMaterialRows.map((row) => row.materialId),
    ]),
  ];
  const materialRows =
    materialIds.length > 0
      ? await db
          .select({
            id: brandMaterials.id,
            name: brandMaterials.name,
            recyclable: brandMaterials.recyclable,
            countryOfOrigin: brandMaterials.countryOfOrigin,
            certificationId: brandMaterials.certificationId,
          })
          .from(brandMaterials)
          .where(inArray(brandMaterials.id, materialIds))
      : [];
  const materialsById = new Map(
    materialRows.map((row) => [
      row.id,
      {
        name: row.name,
        recyclable: row.recyclable,
        countryOfOrigin: row.countryOfOrigin,
        certificationId: row.certificationId,
      },
    ]),
  );

  const certificationIds = [
    ...new Set(
      materialRows
        .map((row) => row.certificationId)
        .filter((value): value is string => value !== null),
    ),
  ];
  const certificationRows =
    certificationIds.length > 0
      ? await db
          .select({
            id: brandCertifications.id,
            title: brandCertifications.title,
            certificationCode: brandCertifications.certificationCode,
            issueDate: brandCertifications.issueDate,
            expiryDate: brandCertifications.expiryDate,
            certificationPath: brandCertifications.certificationPath,
            instituteName: brandCertifications.instituteName,
            instituteEmail: brandCertifications.instituteEmail,
            instituteWebsite: brandCertifications.instituteWebsite,
            instituteAddressLine1: brandCertifications.instituteAddressLine1,
            instituteAddressLine2: brandCertifications.instituteAddressLine2,
            instituteCity: brandCertifications.instituteCity,
            instituteState: brandCertifications.instituteState,
            instituteZip: brandCertifications.instituteZip,
            instituteCountryCode: brandCertifications.instituteCountryCode,
          })
          .from(brandCertifications)
          .where(inArray(brandCertifications.id, certificationIds))
      : [];
  const certificationsById = new Map(
    certificationRows.map((row) => [
      row.id,
      {
        title: row.title,
        certificationCode: row.certificationCode,
        issueDate: row.issueDate,
        expiryDate: row.expiryDate,
        certificationPath: row.certificationPath,
        instituteName: row.instituteName,
        instituteEmail: row.instituteEmail,
        instituteWebsite: row.instituteWebsite,
        instituteAddressLine1: row.instituteAddressLine1,
        instituteAddressLine2: row.instituteAddressLine2,
        instituteCity: row.instituteCity,
        instituteState: row.instituteState,
        instituteZip: row.instituteZip,
        instituteCountryCode: row.instituteCountryCode,
      },
    ]),
  );

  // Load variant and product journey rows for fallback behavior.
  const variantJourneyRows = await db
    .select({
      ownerId: variantJourneySteps.variantId,
      sortIndex: variantJourneySteps.sortIndex,
      stepType: variantJourneySteps.stepType,
      operatorId: variantJourneySteps.operatorId,
    })
    .from(variantJourneySteps)
    .where(inArray(variantJourneySteps.variantId, variantIds))
    .orderBy(
      asc(variantJourneySteps.variantId),
      asc(variantJourneySteps.sortIndex),
    );
  const variantJourneyByVariantId = new Map<string, JourneyRow[]>();
  for (const row of variantJourneyRows) {
    const steps = variantJourneyByVariantId.get(row.ownerId) ?? [];
    steps.push(row);
    variantJourneyByVariantId.set(row.ownerId, steps);
  }

  const productJourneyRows =
    productIds.length > 0
      ? await db
          .select({
            ownerId: productJourneySteps.productId,
            sortIndex: productJourneySteps.sortIndex,
            stepType: productJourneySteps.stepType,
            operatorId: productJourneySteps.operatorId,
          })
          .from(productJourneySteps)
          .where(inArray(productJourneySteps.productId, productIds))
          .orderBy(
            asc(productJourneySteps.productId),
            asc(productJourneySteps.sortIndex),
          )
      : [];
  const productJourneyByProductId = new Map<string, JourneyRow[]>();
  for (const row of productJourneyRows) {
    const steps = productJourneyByProductId.get(row.ownerId) ?? [];
    steps.push(row);
    productJourneyByProductId.set(row.ownerId, steps);
  }

  // Load journey operator details once for all steps.
  const operatorIds = [
    ...new Set([
      ...variantJourneyRows.map((row) => row.operatorId),
      ...productJourneyRows.map((row) => row.operatorId),
    ]),
  ];
  const operatorRows =
    operatorIds.length > 0
      ? await db
          .select({
            id: brandOperators.id,
            displayName: brandOperators.displayName,
            legalName: brandOperators.legalName,
            email: brandOperators.email,
            phone: brandOperators.phone,
            website: brandOperators.website,
            addressLine1: brandOperators.addressLine1,
            addressLine2: brandOperators.addressLine2,
            city: brandOperators.city,
            state: brandOperators.state,
            zip: brandOperators.zip,
            countryCode: brandOperators.countryCode,
          })
          .from(brandOperators)
          .where(inArray(brandOperators.id, operatorIds))
      : [];
  const operatorsById = new Map(
    operatorRows.map((row) => [
      row.id,
      {
        displayName: row.displayName,
        legalName: row.legalName,
        email: row.email,
        phone: row.phone,
        website: row.website,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        state: row.state,
        zip: row.zip,
        countryCode: row.countryCode,
      },
    ]),
  );

  // Build one snapshot per variant while preserving fallback semantics.
  const snapshotsByVariantId = new Map<string, DppSnapshot>();
  for (const row of coreRows) {
    const target = targetByVariantId.get(row.variantId);
    if (!target) {
      continue;
    }

    const attributes = attributesByVariantId.get(row.variantId) ?? [];

    const variantWeightRow = variantWeightByVariantId.get(row.variantId);
    const productWeightRow = productWeightByProductId.get(row.productId);
    const weight = variantWeightRow?.weight
      ? {
          value: Number.parseFloat(variantWeightRow.weight),
          unit: variantWeightRow.weightUnit ?? "grams",
        }
      : productWeightRow?.weight
        ? {
            value: Number.parseFloat(productWeightRow.weight),
            unit: productWeightRow.weightUnit ?? "grams",
          }
        : null;

    const variantEnvRow = variantEnvironmentByVariantId.get(row.variantId);
    const environmental = variantEnvRow
      ? {
          carbonKgCo2e: variantEnvRow.carbonKgCo2e
            ? {
                value: Number.parseFloat(variantEnvRow.carbonKgCo2e),
                unit: "kgCO2e",
              }
            : null,
          waterLiters: variantEnvRow.waterLiters
            ? {
                value: Number.parseFloat(variantEnvRow.waterLiters),
                unit: "liters",
              }
            : null,
        }
      : buildEnvironmentalSnapshot(
          productEnvironmentByProductId.get(row.productId) ?? null,
        );

    const variantMaterialLinks =
      variantMaterialsByVariantId.get(row.variantId) ?? [];
    const productMaterialLinks =
      productMaterialsByProductId.get(row.productId) ?? [];
    const materialLinks =
      variantMaterialLinks.length > 0
        ? variantMaterialLinks
        : productMaterialLinks;
    const materials = buildMaterialsSnapshot(
      materialLinks,
      materialsById,
      certificationsById,
      storageBaseUrl,
    );

    const variantJourney = variantJourneyByVariantId.get(row.variantId) ?? [];
    const productJourney = productJourneyByProductId.get(row.productId) ?? [];
    const supplyChain = buildSupplyChainSnapshot(
      variantJourney.length > 0 ? variantJourney : productJourney,
      operatorsById,
    );

    const imagePath = row.variantImagePath ?? row.productImagePath;

    const snapshot: DppSnapshot = {
      "@context": {
        "@vocab": "https://schema.org/",
        dpp: "https://avelero.com/dpp/v1/",
        espr: "https://ec.europa.eu/espr/",
      },
      "@type": "dpp:DigitalProductPassport",
      "@id": `https://passport.avelero.com/${target.upid}`,
      productIdentifiers: {
        upid: target.upid,
        sku: row.variantSku,
        barcode: row.variantBarcode,
      },
      productAttributes: {
        name: row.variantName ?? row.productName,
        description: row.variantDescription ?? row.productDescription,
        image: buildProductImageUrl(storageBaseUrl, imagePath),
        category: row.productCategoryId
          ? categoryById.get(row.productCategoryId) ?? null
          : null,
        manufacturer: row.productManufacturerId
          ? manufacturerById.get(row.productManufacturerId) ?? null
          : null,
        attributes,
        weight,
      },
      environmental,
      materials,
      supplyChain,
      metadata: {
        schemaVersion: DEFAULT_SCHEMA_VERSION,
        publishedAt: new Date().toISOString(),
        versionNumber: 0,
      },
    };

    snapshotsByVariantId.set(row.variantId, snapshot);
  }

  return snapshotsByVariantId;
}

// =============================================================================
// CHUNK PUBLISH
// =============================================================================

/**
 * Publish one variant chunk with bulk version inserts and passport updates.
 */
async function publishVariantChunk(
  db: Database,
  targets: VariantPublishTarget[],
  schemaVersion: string,
): Promise<PublishVariantChunkResult> {
  // Skip empty chunks.
  if (targets.length === 0) {
    return {
      versionsCreated: 0,
      versionsSkippedUnchanged: 0,
    };
  }

  const snapshotsByVariantId = await buildSnapshotsForVariantChunk(db, targets);

  const currentVersionIds = [
    ...new Set(
      targets
        .map((target) => target.currentVersionId)
        .filter((value): value is string => value !== null),
    ),
  ];

  // Load current version rows once for dedupe and version-number increments.
  const currentVersions =
    currentVersionIds.length > 0
      ? await db
          .select({
            id: productPassportVersions.id,
            passportId: productPassportVersions.passportId,
            versionNumber: productPassportVersions.versionNumber,
            dataSnapshot: productPassportVersions.dataSnapshot,
            compressedSnapshot: productPassportVersions.compressedSnapshot,
          })
          .from(productPassportVersions)
          .where(inArray(productPassportVersions.id, currentVersionIds))
      : [];
  const currentVersionByPassportId = new Map(
    currentVersions.map((row) => [row.passportId, row]),
  );

  // Build version inserts for changed content only.
  let versionsSkippedUnchanged = 0;
  const versionInserts: Array<{
    passportId: string;
    versionNumber: number;
    dataSnapshot: DppSnapshot;
    contentHash: string;
    schemaVersion: string;
    publishedAt: string;
  }> = [];

  for (const target of targets) {
    const snapshot = snapshotsByVariantId.get(target.variantId);
    if (!snapshot) {
      throw new Error(
        `Failed to build snapshot for variant ${target.variantId}`,
      );
    }

    const currentVersion = currentVersionByPassportId.get(target.passportId);
    if (currentVersion) {
      const existingSnapshot = getVersionSnapshot({
        dataSnapshot: currentVersion.dataSnapshot as DppSnapshot | null,
        compressedSnapshot: currentVersion.compressedSnapshot,
      });
      const newContentHash = calculateContentOnlyHash(snapshot);
      const existingContentHash = existingSnapshot
        ? calculateContentOnlyHash(existingSnapshot)
        : null;
      if (
        existingContentHash !== null &&
        newContentHash === existingContentHash
      ) {
        versionsSkippedUnchanged++;
        continue;
      }
    }

    const nextVersionNumber = (currentVersion?.versionNumber ?? 0) + 1;
    const publishedAt = new Date().toISOString();
    const snapshotWithMetadata: DppSnapshot = {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        versionNumber: nextVersionNumber,
        publishedAt,
        schemaVersion,
      },
    };

    versionInserts.push({
      passportId: target.passportId,
      versionNumber: nextVersionNumber,
      dataSnapshot: snapshotWithMetadata,
      contentHash: calculateSnapshotHash(snapshotWithMetadata),
      schemaVersion,
      publishedAt,
    });
  }

  // Nothing changed in this chunk.
  if (versionInserts.length === 0) {
    return {
      versionsCreated: 0,
      versionsSkippedUnchanged,
    };
  }

  // Insert all versions for this chunk in one query.
  const insertedVersions = await db.transaction(async (tx) => {
    // Insert new immutable versions for changed snapshots.
    const inserted = await tx
      .insert(productPassportVersions)
      .values(versionInserts)
      .returning({
        id: productPassportVersions.id,
        passportId: productPassportVersions.passportId,
      });

    // Update passport pointers using a VALUES mapping in one statement.
    const versionMappings = sql.join(
      inserted.map((row) => sql`(${row.passportId}::uuid, ${row.id}::uuid)`),
      sql`, `,
    );
    const updatedAt = new Date().toISOString();

    await tx.execute(sql`
      UPDATE ${productPassports}
      SET
        current_version_id = version_map.version_id,
        updated_at = ${updatedAt}
      FROM (VALUES ${versionMappings}) AS version_map(passport_id, version_id)
      WHERE ${productPassports.id} = version_map.passport_id
    `);

    return inserted;
  });

  return {
    versionsCreated: insertedVersions.length,
    versionsSkippedUnchanged,
  };
}

// =============================================================================
// MAIN ENTRYPOINT
// =============================================================================

/**
 * Publish products set-based for commit workflows.
 *
 * Only products currently in "published" status are processed.
 */
export async function publishProductsSetBased(
  db: Database,
  input: PublishProductsSetBasedInput,
): Promise<PublishProductsSetBasedResult> {
  // Normalize and dedupe requested product IDs.
  const uniqueProductIds = [...new Set(input.productIds)];
  if (uniqueProductIds.length === 0) {
    return {
      totalProductsRequested: 0,
      totalProductsPublishedStatus: 0,
      totalVariantsConsidered: 0,
      totalVariantsSkippedNoUpid: 0,
      passportsCreated: 0,
      versionsCreated: 0,
      versionsSkippedUnchanged: 0,
    };
  }

  // Only process products that are currently published.
  const publishedProductRows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.brandId, input.brandId),
        inArray(products.id, uniqueProductIds),
        eq(products.status, "published"),
      ),
    );
  const publishedProductIds = publishedProductRows.map((row) => row.id);

  if (publishedProductIds.length === 0) {
    return {
      totalProductsRequested: uniqueProductIds.length,
      totalProductsPublishedStatus: 0,
      totalVariantsConsidered: 0,
      totalVariantsSkippedNoUpid: 0,
      passportsCreated: 0,
      versionsCreated: 0,
      versionsSkippedUnchanged: 0,
    };
  }

  // Load all variants for the published products.
  const variantRows = await db
    .select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      upid: productVariants.upid,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
    })
    .from(productVariants)
    .where(inArray(productVariants.productId, publishedProductIds));

  if (variantRows.length === 0) {
    return {
      totalProductsRequested: uniqueProductIds.length,
      totalProductsPublishedStatus: publishedProductIds.length,
      totalVariantsConsidered: 0,
      totalVariantsSkippedNoUpid: 0,
      passportsCreated: 0,
      versionsCreated: 0,
      versionsSkippedUnchanged: 0,
    };
  }

  // Skip variants that do not have a publishable UPID.
  const publishableVariants = variantRows.filter(
    (row): row is VariantIdentityRow & { upid: string } =>
      row.upid !== null && row.upid.trim().length > 0,
  );
  const totalVariantsSkippedNoUpid =
    variantRows.length - publishableVariants.length;

  if (publishableVariants.length === 0) {
    return {
      totalProductsRequested: uniqueProductIds.length,
      totalProductsPublishedStatus: publishedProductIds.length,
      totalVariantsConsidered: variantRows.length,
      totalVariantsSkippedNoUpid,
      passportsCreated: 0,
      versionsCreated: 0,
      versionsSkippedUnchanged: 0,
    };
  }

  const publishableVariantIds = publishableVariants.map((row) => row.variantId);

  // Load existing passports for publishable variants.
  const existingPassports = await db
    .select({
      id: productPassports.id,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
    })
    .from(productPassports)
    .where(inArray(productPassports.workingVariantId, publishableVariantIds));
  const passportsByVariantId = new Map<
    string,
    {
      id: string;
      currentVersionId: string | null;
    }
  >();
  for (const passport of existingPassports) {
    passportsByVariantId.set(passport.workingVariantId, {
      id: passport.id,
      currentVersionId: passport.currentVersionId,
    });
  }

  // Create missing passports in one bulk operation.
  const variantsWithoutPassport = publishableVariants.filter(
    (row) => !passportsByVariantId.has(row.variantId),
  );
  if (variantsWithoutPassport.length > 0) {
    const createdPassports = await batchCreatePassportsForVariants(
      db,
      variantsWithoutPassport.map((row) => row.variantId),
    );

    for (const passport of createdPassports) {
      passportsByVariantId.set(passport.workingVariantId, {
        id: passport.id,
        currentVersionId: passport.currentVersionId,
      });
    }
  }

  // Build variant publish targets.
  const publishTargets: VariantPublishTarget[] = publishableVariants.map(
    (row) => {
      const passport = passportsByVariantId.get(row.variantId);
      if (!passport) {
        throw new Error(
          `Missing passport after ensure step for variant ${row.variantId}`,
        );
      }

      return {
        variantId: row.variantId,
        productId: row.productId,
        upid: row.upid,
        passportId: passport.id,
        currentVersionId: passport.currentVersionId,
      };
    },
  );

  const variantChunkSize = Math.max(
    1,
    input.variantChunkSize ?? DEFAULT_VARIANT_CHUNK_SIZE,
  );
  const schemaVersion = input.schemaVersion ?? DEFAULT_SCHEMA_VERSION;
  const chunks = chunkArray(publishTargets, variantChunkSize);

  // Publish chunks sequentially (no added parallelism).
  let versionsCreated = 0;
  let versionsSkippedUnchanged = 0;
  for (const chunk of chunks) {
    const chunkResult = await publishVariantChunk(db, chunk, schemaVersion);
    versionsCreated += chunkResult.versionsCreated;
    versionsSkippedUnchanged += chunkResult.versionsSkippedUnchanged;
  }

  return {
    totalProductsRequested: uniqueProductIds.length,
    totalProductsPublishedStatus: publishedProductIds.length,
    totalVariantsConsidered: variantRows.length,
    totalVariantsSkippedNoUpid,
    passportsCreated: variantsWithoutPassport.length,
    versionsCreated,
    versionsSkippedUnchanged,
  };
}
