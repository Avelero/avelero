/**
 * DPP Snapshot Generation.
 *
 * Generates self-contained JSON-LD snapshots from working layer data.
 * These snapshots are stored in dpp_versions and can be rendered
 * without any additional database queries.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
  products,
  productVariants,
  productCommercial,
  productEnvironment,
  productMaterials,
  productWeight,
  productJourneySteps,
  productVariantAttributes,
  variantCommercial,
  variantEnvironment,
  variantMaterials,
  variantWeight,
  variantJourneySteps,
  brandMaterials,
  brandCertifications,
  brandOperators,
  brandManufacturers,
  brandAttributes,
  brandAttributeValues,
  taxonomyCategories,
} from "../../schema";
import type { DppSnapshot } from "./dpp-versions";
import {
  buildProductImageUrl,
  getSupabaseUrlFromEnv,
} from "../../utils/storage-url";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for snapshot generation.
 */
export interface SnapshotOptions {
  /**
   * Supabase storage base URL for building full image URLs.
   * If not provided, will attempt to read from environment.
   * Image paths will be stored as full URLs in the snapshot.
   */
  storageBaseUrl?: string;
}

// =============================================================================
// INTERNAL FETCH FUNCTIONS
// =============================================================================

/**
 * Fetch core product and variant data.
 */
async function fetchCoreData(db: Database, variantId: string) {
  const [row] = await db
    .select({
      // Variant data
      variantId: productVariants.id,
      variantUpid: productVariants.upid,
      variantSku: productVariants.sku,
      variantBarcode: productVariants.barcode,
      variantName: productVariants.name,
      variantDescription: productVariants.description,
      variantImagePath: productVariants.imagePath,
      // Product data
      productId: products.id,
      productName: products.name,
      productDescription: products.description,
      productImagePath: products.imagePath,
      productCategoryId: products.categoryId,
      productManufacturerId: products.manufacturerId,
      brandId: products.brandId,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, variantId))
    .limit(1);

  return row ?? null;
}

/**
 * Fetch category name by ID.
 */
async function fetchCategoryName(
  db: Database,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) return null;

  const [row] = await db
    .select({ name: taxonomyCategories.name })
    .from(taxonomyCategories)
    .where(eq(taxonomyCategories.id, categoryId))
    .limit(1);

  return row?.name ?? null;
}

/**
 * Fetch manufacturer details by ID.
 */
async function fetchManufacturer(db: Database, manufacturerId: string | null) {
  if (!manufacturerId) return null;

  const [row] = await db
    .select({
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
    .where(eq(brandManufacturers.id, manufacturerId))
    .limit(1);

  return row ?? null;
}

/**
 * Fetch variant attributes (name/value pairs).
 */
async function fetchVariantAttributeValues(
  db: Database,
  variantId: string,
): Promise<Array<{ name: string; value: string }>> {
  const rows = await db
    .select({
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
    .where(eq(productVariantAttributes.variantId, variantId))
    .orderBy(asc(productVariantAttributes.sortOrder));

  return rows.map((r) => ({
    name: r.attributeName,
    value: r.valueName,
  }));
}

/**
 * Fetch weight data (variant ?? product level).
 */
async function fetchWeight(
  db: Database,
  variantId: string,
  productId: string,
): Promise<{ value: number; unit: string } | null> {
  // Try variant-level first
  const [variantWeightRow] = await db
    .select({
      weight: variantWeight.weight,
      weightUnit: variantWeight.weightUnit,
    })
    .from(variantWeight)
    .where(eq(variantWeight.variantId, variantId))
    .limit(1);

  if (variantWeightRow?.weight) {
    return {
      value: Number.parseFloat(variantWeightRow.weight),
      unit: variantWeightRow.weightUnit ?? "grams",
    };
  }

  // Fall back to product-level
  const [productWeightRow] = await db
    .select({
      weight: productWeight.weight,
      weightUnit: productWeight.weightUnit,
    })
    .from(productWeight)
    .where(eq(productWeight.productId, productId))
    .limit(1);

  if (productWeightRow?.weight) {
    return {
      value: Number.parseFloat(productWeightRow.weight),
      unit: productWeightRow.weightUnit ?? "grams",
    };
  }

  return null;
}

/**
 * Fetch environment data (variant ?? product level).
 */
async function fetchEnvironment(
  db: Database,
  variantId: string,
  productId: string,
): Promise<DppSnapshot["environmental"] | null> {
  // Try variant-level first
  const [variantEnvRow] = await db
    .select({
      carbonKgCo2e: variantEnvironment.carbonKgCo2e,
      waterLiters: variantEnvironment.waterLiters,
    })
    .from(variantEnvironment)
    .where(eq(variantEnvironment.variantId, variantId))
    .limit(1);

  if (variantEnvRow) {
    return {
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
    };
  }

  // Fall back to product-level (normalized metric-keyed rows)
  const productEnvRows = await db
    .select({
      metric: productEnvironment.metric,
      value: productEnvironment.value,
    })
    .from(productEnvironment)
    .where(eq(productEnvironment.productId, productId));

  if (productEnvRows.length === 0) return null;

  const carbonRow = productEnvRows.find((r) => r.metric === "carbon_kg_co2e");
  const waterRow = productEnvRows.find((r) => r.metric === "water_liters");

  if (!carbonRow && !waterRow) return null;

  return {
    carbonKgCo2e: carbonRow?.value
      ? { value: Number.parseFloat(carbonRow.value), unit: "kgCO2e" }
      : null,
    waterLiters: waterRow?.value
      ? { value: Number.parseFloat(waterRow.value), unit: "liters" }
      : null,
  };
}

/**
 * Fetch materials with full certification details (variant ?? product level).
 */
async function fetchMaterialsWithCertifications(
  db: Database,
  variantId: string,
  productId: string,
): Promise<DppSnapshot["materials"] | null> {
  // Try variant-level first
  const variantMaterialRows = await db
    .select({
      materialId: variantMaterials.brandMaterialId,
      percentage: variantMaterials.percentage,
    })
    .from(variantMaterials)
    .where(eq(variantMaterials.variantId, variantId));

  let materialLinks: Array<{ materialId: string; percentage: string | null }>;

  if (variantMaterialRows.length > 0) {
    materialLinks = variantMaterialRows;
  } else {
    // Fall back to product-level
    const productMaterialRows = await db
      .select({
        materialId: productMaterials.brandMaterialId,
        percentage: productMaterials.percentage,
      })
      .from(productMaterials)
      .where(eq(productMaterials.productId, productId))
      .orderBy(asc(productMaterials.createdAt));

    if (productMaterialRows.length === 0) return null;
    materialLinks = productMaterialRows;
  }

  // Fetch full material details with certifications
  const materialIds = materialLinks.map((m) => m.materialId);
  const materialsData = await db
    .select({
      id: brandMaterials.id,
      name: brandMaterials.name,
      recyclable: brandMaterials.recyclable,
      countryOfOrigin: brandMaterials.countryOfOrigin,
      certificationId: brandMaterials.certificationId,
    })
    .from(brandMaterials)
    .where(inArray(brandMaterials.id, materialIds));

  // Create a map for quick lookup
  const materialsMap = new Map(materialsData.map((m) => [m.id, m]));

  // Fetch certifications for all materials that have them
  const certificationIds = materialsData
    .filter((m) => m.certificationId)
    .map((m) => m.certificationId as string);

  const certificationsMap = new Map<
    string,
    {
      title: string;
      certificationCode: string | null;
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
  >();

  if (certificationIds.length > 0) {
    const certifications = await db
      .select({
        id: brandCertifications.id,
        title: brandCertifications.title,
        certificationCode: brandCertifications.certificationCode,
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
      .where(inArray(brandCertifications.id, certificationIds));

    for (const cert of certifications) {
      certificationsMap.set(cert.id, cert);
    }
  }

  // Build the composition array
  const composition = materialLinks
    .map((link) => {
      const material = materialsMap.get(link.materialId);
      if (!material) return null;

      const certification = material.certificationId
        ? certificationsMap.get(material.certificationId)
        : null;

      return {
        material: material.name,
        percentage: link.percentage ? Number.parseFloat(link.percentage) : null,
        recyclable: material.recyclable,
        countryOfOrigin: material.countryOfOrigin,
        certification: certification
          ? {
              title: certification.title,
              certificationCode: certification.certificationCode,
              testingInstitute: certification.instituteName
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
    .filter((m): m is NonNullable<typeof m> => m !== null);

  if (composition.length === 0) return null;

  return { composition };
}

/**
 * Fetch supply chain journey with full operator details (variant ?? product level).
 */
async function fetchSupplyChain(
  db: Database,
  variantId: string,
  productId: string,
): Promise<DppSnapshot["supplyChain"]> {
  // Try variant-level first
  const variantJourneyRows = await db
    .select({
      stepType: variantJourneySteps.stepType,
      sortIndex: variantJourneySteps.sortIndex,
      operatorId: variantJourneySteps.operatorId,
    })
    .from(variantJourneySteps)
    .where(eq(variantJourneySteps.variantId, variantId))
    .orderBy(asc(variantJourneySteps.sortIndex));

  let journeySteps: Array<{
    stepType: string;
    sortIndex: number;
    operatorId: string;
  }>;

  if (variantJourneyRows.length > 0) {
    journeySteps = variantJourneyRows;
  } else {
    // Fall back to product-level
    const productJourneyRows = await db
      .select({
        stepType: productJourneySteps.stepType,
        sortIndex: productJourneySteps.sortIndex,
        operatorId: productJourneySteps.operatorId,
      })
      .from(productJourneySteps)
      .where(eq(productJourneySteps.productId, productId))
      .orderBy(asc(productJourneySteps.sortIndex));

    journeySteps = productJourneyRows;
  }

  if (journeySteps.length === 0) return [];

  // Fetch full operator details
  const operatorIds = [...new Set(journeySteps.map((s) => s.operatorId))];
  const operators = await db
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
    .where(inArray(brandOperators.id, operatorIds));

  const operatorsMap = new Map(operators.map((o) => [o.id, o]));

  // Group by step type and sort index, collecting operators
  const supplyChain: DppSnapshot["supplyChain"] = [];
  const stepMap = new Map<
    string,
    {
      stepType: string;
      sortIndex: number;
      operators: DppSnapshot["supplyChain"][0]["operators"];
    }
  >();

  for (const step of journeySteps) {
    const key = `${step.sortIndex}-${step.stepType}`;
    const operatorData = operatorsMap.get(step.operatorId);

    if (!operatorData) continue;

    const operator = {
      displayName: operatorData.displayName,
      legalName: operatorData.legalName,
      email: operatorData.email,
      phone: operatorData.phone,
      website: operatorData.website,
      addressLine1: operatorData.addressLine1,
      addressLine2: operatorData.addressLine2,
      city: operatorData.city,
      state: operatorData.state,
      zip: operatorData.zip,
      countryCode: operatorData.countryCode,
    };

    if (stepMap.has(key)) {
      stepMap.get(key)!.operators.push(operator);
    } else {
      stepMap.set(key, {
        stepType: step.stepType,
        sortIndex: step.sortIndex,
        operators: [operator],
      });
    }
  }

  // Sort by sortIndex and return
  return Array.from(stepMap.values()).sort((a, b) => a.sortIndex - b.sortIndex);
}

// =============================================================================
// MAIN SNAPSHOT GENERATION
// =============================================================================

/**
 * Generate a complete JSON-LD snapshot for a variant.
 *
 * @param db - Database instance
 * @param variantId - The variant ID to generate snapshot for
 * @param upid - The UPID for the passport (used in @id URL)
 * @param options - Optional configuration including storage base URL
 * @returns The complete DPP snapshot, or null if variant not found
 */
export async function generateDppSnapshot(
  db: Database,
  variantId: string,
  upid: string,
  options?: SnapshotOptions,
): Promise<DppSnapshot | null> {
  // Fetch core data
  const coreData = await fetchCoreData(db, variantId);
  if (!coreData) return null;

  // Fetch all related data in parallel
  const [
    categoryName,
    manufacturer,
    attributes,
    weight,
    environment,
    materials,
    supplyChain,
  ] = await Promise.all([
    fetchCategoryName(db, coreData.productCategoryId),
    fetchManufacturer(db, coreData.productManufacturerId),
    fetchVariantAttributeValues(db, variantId),
    fetchWeight(db, variantId, coreData.productId),
    fetchEnvironment(db, variantId, coreData.productId),
    fetchMaterialsWithCertifications(db, variantId, coreData.productId),
    fetchSupplyChain(db, variantId, coreData.productId),
  ]);

  // Resolve display values (variant ?? product)
  const name = coreData.variantName ?? coreData.productName;
  const description =
    coreData.variantDescription ?? coreData.productDescription;
  const imagePath = coreData.variantImagePath ?? coreData.productImagePath;

  // Build full image URL from storage path
  // Uses provided storageBaseUrl or falls back to environment variable
  const storageBaseUrl = options?.storageBaseUrl ?? getSupabaseUrlFromEnv();
  const image = buildProductImageUrl(storageBaseUrl, imagePath);

  // Build the snapshot
  const snapshot: DppSnapshot = {
    "@context": {
      "@vocab": "https://schema.org/",
      dpp: "https://avelero.com/dpp/v1/",
      espr: "https://ec.europa.eu/espr/",
    },
    "@type": "dpp:DigitalProductPassport",
    "@id": `https://passport.avelero.com/${upid}`,
    productIdentifiers: {
      upid,
      sku: coreData.variantSku,
      barcode: coreData.variantBarcode,
    },
    productAttributes: {
      name,
      description,
      image,
      category: categoryName,
      manufacturer,
      attributes,
      weight,
    },
    environmental: environment,
    materials,
    supplyChain,
    metadata: {
      schemaVersion: "1.0",
      publishedAt: new Date().toISOString(),
      versionNumber: 0, // Will be set by createDppVersion
    },
  };

  return snapshot;
}

/**
 * Check if a snapshot would differ from the current published version.
 * Useful for detecting if we actually need to create a new version.
 *
 * @param db - Database instance
 * @param variantId - The variant ID
 * @param upid - The UPID for the passport
 * @param currentSnapshot - The current published snapshot (if any)
 * @param options - Optional configuration including storage base URL
 * @returns True if the new snapshot would be different
 */
export async function wouldSnapshotDiffer(
  db: Database,
  variantId: string,
  upid: string,
  currentSnapshot: DppSnapshot | null,
  options?: SnapshotOptions,
): Promise<boolean> {
  if (!currentSnapshot) return true;

  const newSnapshot = await generateDppSnapshot(db, variantId, upid, options);
  if (!newSnapshot) return false;

  // Compare the snapshots (excluding metadata which will always differ)
  const compareSnapshot = (s: DppSnapshot) => ({
    productIdentifiers: s.productIdentifiers,
    productAttributes: s.productAttributes,
    environmental: s.environmental,
    materials: s.materials,
    supplyChain: s.supplyChain,
  });

  const current = JSON.stringify(compareSnapshot(currentSnapshot));
  const next = JSON.stringify(compareSnapshot(newSnapshot));

  return current !== next;
}
