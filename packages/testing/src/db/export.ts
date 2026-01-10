/**
 * Export Test Helpers
 *
 * Provides helper functions for creating test data specific to export testing.
 * These helpers create products, variants, and related data with all the
 * fields needed to test Excel export functionality.
 *
 * @module @v1/testing/db/export
 */

import * as schema from "@v1/db/schema";
import { and, eq } from "drizzle-orm";
import { testDb, createTestBrand } from "../db";

// ============================================================================
// Types
// ============================================================================

export interface CreateTestProductForExportOptions {
    name?: string;
    handle?: string;
    description?: string;
    imagePath?: string;
    status?: string;
    tags?: string[];
    materials?: Array<{ name: string; percentage: number | null }>;
    ecoClaims?: string[];
    carbonKg?: number;
    waterLiters?: number;
    weightGrams?: number;
    journeySteps?: Record<string, string>; // stepType -> facilityName
    categoryId?: string;
    manufacturerName?: string;
    seasonName?: string;
}

export interface CreateTestVariantWithOverridesOptions {
    upid?: string;
    sku?: string;
    barcode?: string;
    attributes?: Array<{ name: string; value: string }>;
    // Variant-level overrides
    nameOverride?: string;
    descriptionOverride?: string;
    imagePathOverride?: string;
    carbonKgOverride?: number;
    waterLitersOverride?: number;
    weightGramsOverride?: number;
    materialsOverride?: Array<{ name: string; percentage: number | null }>;
    ecoClaimsOverride?: string[];
    journeyStepsOverride?: Record<string, string>;
}

export interface CreateTestExportJobOptions {
    status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    selectionMode?: "all" | "explicit";
    includeIds?: string[];
    excludeIds?: string[];
    filterState?: unknown;
    searchQuery?: string;
    totalProducts?: number;
    productsProcessed?: number;
    filePath?: string;
    downloadUrl?: string;
    expiresAt?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a complete test product with all related data for export testing.
 * Returns the product ID.
 */
export async function createTestProductForExport(
    brandId: string,
    options: CreateTestProductForExportOptions = {},
): Promise<string> {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const name = options.name ?? `Test Product ${randomSuffix}`;
    const handle = options.handle ?? `test-product-${randomSuffix}`;

    // Create manufacturer if needed
    let manufacturerId: string | undefined;
    if (options.manufacturerName) {
        const [mfr] = await testDb
            .insert(schema.brandManufacturers)
            .values({
                brandId,
                name: options.manufacturerName,
            })
            .returning({ id: schema.brandManufacturers.id });
        manufacturerId = mfr?.id;
    }

    // Create season if needed
    let seasonId: string | undefined;
    if (options.seasonName) {
        const [season] = await testDb
            .insert(schema.brandSeasons)
            .values({
                brandId,
                name: options.seasonName,
            })
            .returning({ id: schema.brandSeasons.id });
        seasonId = season?.id;
    }

    // Create the product
    const [product] = await testDb
        .insert(schema.products)
        .values({
            brandId,
            name,
            productHandle: handle,
            description: options.description,
            imagePath: options.imagePath,
            status: options.status ?? "published",
            categoryId: options.categoryId,
            manufacturerId,
            seasonId,
        })
        .returning({ id: schema.products.id });

    if (!product) {
        throw new Error("Failed to create test product");
    }

    const productId = product.id;

    // Create tags if specified
    if (options.tags && options.tags.length > 0) {
        for (const tagName of options.tags) {
            // Create the brand tag (or use existing one)
            const [tag] = await testDb
                .insert(schema.brandTags)
                .values({
                    brandId,
                    name: tagName,
                })
                .onConflictDoNothing()
                .returning({ id: schema.brandTags.id });

            let tagId = tag?.id;
            if (!tagId) {
                // Tag already exists, find it
                const [existing] = await testDb
                    .select({ id: schema.brandTags.id })
                    .from(schema.brandTags)
                    .where(
                        and(
                            eq(schema.brandTags.brandId, brandId),
                            eq(schema.brandTags.name, tagName),
                        ),
                    )
                    .limit(1);
                tagId = existing?.id;
            }

            if (tagId) {
                // Link tag to product
                await testDb.insert(schema.productTags).values({
                    productId,
                    tagId,
                });
            }
        }
    }

    // Create materials if specified
    if (options.materials && options.materials.length > 0) {
        for (const material of options.materials) {
            // Create the brand material (or use existing one)
            const [brandMaterial] = await testDb
                .insert(schema.brandMaterials)
                .values({
                    brandId,
                    name: material.name,
                })
                .onConflictDoNothing()
                .returning({ id: schema.brandMaterials.id });

            let materialId = brandMaterial?.id;
            if (!materialId) {
                // Material already exists, find it
                const [existing] = await testDb
                    .select({ id: schema.brandMaterials.id })
                    .from(schema.brandMaterials)
                    .where(
                        and(
                            eq(schema.brandMaterials.brandId, brandId),
                            eq(schema.brandMaterials.name, material.name),
                        ),
                    )
                    .limit(1);
                materialId = existing?.id;
            }

            if (materialId) {
                // Link material to product
                await testDb.insert(schema.productMaterials).values({
                    productId,
                    brandMaterialId: materialId,
                    percentage: material.percentage?.toString(),
                });
            }
        }
    }

    // Create eco-claims if specified
    if (options.ecoClaims && options.ecoClaims.length > 0) {
        for (const claim of options.ecoClaims) {
            // Create the brand eco-claim (or use existing one)
            const [ecoClaim] = await testDb
                .insert(schema.brandEcoClaims)
                .values({
                    brandId,
                    claim,
                })
                .onConflictDoNothing()
                .returning({ id: schema.brandEcoClaims.id });

            let ecoClaimId = ecoClaim?.id;
            if (!ecoClaimId) {
                // Eco-claim already exists, find it
                const [existing] = await testDb
                    .select({ id: schema.brandEcoClaims.id })
                    .from(schema.brandEcoClaims)
                    .where(
                        and(
                            eq(schema.brandEcoClaims.brandId, brandId),
                            eq(schema.brandEcoClaims.claim, claim),
                        ),
                    )
                    .limit(1);
                ecoClaimId = existing?.id;
            }

            if (ecoClaimId) {
                // Link eco-claim to product
                await testDb.insert(schema.productEcoClaims).values({
                    productId,
                    ecoClaimId,
                });
            }
        }
    }

    // Create environment data if specified
    if (options.carbonKg !== undefined) {
        await testDb.insert(schema.productEnvironment).values({
            productId,
            metric: "carbon_kg_co2e",
            value: options.carbonKg.toString(),
            unit: "kg",
        });
    }

    if (options.waterLiters !== undefined) {
        await testDb.insert(schema.productEnvironment).values({
            productId,
            metric: "water_liters",
            value: options.waterLiters.toString(),
            unit: "L",
        });
    }

    // Create weight if specified
    if (options.weightGrams !== undefined) {
        await testDb.insert(schema.productWeight).values({
            productId,
            weight: options.weightGrams.toString(),
            weightUnit: "g",
        });
    }

    // Create journey steps if specified
    if (options.journeySteps && Object.keys(options.journeySteps).length > 0) {
        let sortIndex = 0;
        for (const [stepType, facilityName] of Object.entries(options.journeySteps)) {
            // Create the facility
            const [facility] = await testDb
                .insert(schema.brandFacilities)
                .values({
                    brandId,
                    displayName: facilityName,
                })
                .returning({ id: schema.brandFacilities.id });

            if (facility) {
                // Create the journey step
                await testDb.insert(schema.productJourneySteps).values({
                    productId,
                    stepType,
                    facilityId: facility.id,
                    sortIndex,
                });
                sortIndex++;
            }
        }
    }

    return productId;
}

/**
 * Creates a variant with override data for testing override resolution.
 * Returns the variant ID.
 */
export async function createTestVariantWithOverrides(
    productId: string,
    brandId: string,
    options: CreateTestVariantWithOverridesOptions = {},
): Promise<string> {
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    // Create the variant
    const [variant] = await testDb
        .insert(schema.productVariants)
        .values({
            productId,
            upid: options.upid ?? `UPID-${randomSuffix}`,
            sku: options.sku,
            barcode: options.barcode,
            name: options.nameOverride,
            description: options.descriptionOverride,
            imagePath: options.imagePathOverride,
        })
        .returning({ id: schema.productVariants.id });

    if (!variant) {
        throw new Error("Failed to create test variant");
    }

    const variantId = variant.id;

    // Create variant attributes if specified
    if (options.attributes && options.attributes.length > 0) {
        let sortOrder = 0;
        for (const attr of options.attributes) {
            // Create or get the brand attribute
            const [brandAttr] = await testDb
                .insert(schema.brandAttributes)
                .values({
                    brandId,
                    name: attr.name,
                })
                .onConflictDoNothing()
                .returning({ id: schema.brandAttributes.id });

            let attributeId = brandAttr?.id;
            if (!attributeId) {
                // Attribute already exists, find it
                const [existing] = await testDb
                    .select({ id: schema.brandAttributes.id })
                    .from(schema.brandAttributes)
                    .where(
                        and(
                            eq(schema.brandAttributes.brandId, brandId),
                            eq(schema.brandAttributes.name, attr.name),
                        ),
                    )
                    .limit(1);
                attributeId = existing?.id;
            }

            if (attributeId) {
                // Create the attribute value
                const [attrValue] = await testDb
                    .insert(schema.brandAttributeValues)
                    .values({
                        brandId,
                        attributeId,
                        name: attr.value,
                    })
                    .onConflictDoNothing()
                    .returning({ id: schema.brandAttributeValues.id });

                let attributeValueId = attrValue?.id;
                if (!attributeValueId) {
                    // Value already exists, find it
                    const [existing] = await testDb
                        .select({ id: schema.brandAttributeValues.id })
                        .from(schema.brandAttributeValues)
                        .where(
                            and(
                                eq(schema.brandAttributeValues.brandId, brandId),
                                eq(schema.brandAttributeValues.attributeId, attributeId),
                                eq(schema.brandAttributeValues.name, attr.value),
                            ),
                        )
                        .limit(1);
                    attributeValueId = existing?.id;
                }

                if (attributeValueId) {
                    // Link attribute value to variant
                    await testDb.insert(schema.productVariantAttributes).values({
                        variantId,
                        attributeValueId,
                        sortOrder,
                    });
                    sortOrder++;
                }
            }
        }
    }

    // Create environment overrides if specified
    if (options.carbonKgOverride !== undefined || options.waterLitersOverride !== undefined) {
        await testDb.insert(schema.variantEnvironment).values({
            variantId,
            carbonKgCo2e: options.carbonKgOverride?.toString(),
            waterLiters: options.waterLitersOverride?.toString(),
        });
    }

    // Create weight override if specified
    if (options.weightGramsOverride !== undefined) {
        await testDb.insert(schema.variantWeight).values({
            variantId,
            weight: options.weightGramsOverride.toString(),
            weightUnit: "g",
        });
    }

    // Create materials override if specified
    if (options.materialsOverride && options.materialsOverride.length > 0) {
        for (const material of options.materialsOverride) {
            // Create the brand material
            const [brandMaterial] = await testDb
                .insert(schema.brandMaterials)
                .values({
                    brandId,
                    name: material.name,
                })
                .onConflictDoNothing()
                .returning({ id: schema.brandMaterials.id });

            let materialId = brandMaterial?.id;
            if (!materialId) {
                // Material already exists, find it
                const [existing] = await testDb
                    .select({ id: schema.brandMaterials.id })
                    .from(schema.brandMaterials)
                    .where(
                        and(
                            eq(schema.brandMaterials.brandId, brandId),
                            eq(schema.brandMaterials.name, material.name),
                        ),
                    )
                    .limit(1);
                materialId = existing?.id;
            }

            if (materialId) {
                await testDb.insert(schema.variantMaterials).values({
                    variantId,
                    brandMaterialId: materialId,
                    percentage: material.percentage?.toString(),
                });
            }
        }
    }

    // Create eco-claims override if specified
    if (options.ecoClaimsOverride && options.ecoClaimsOverride.length > 0) {
        for (const claim of options.ecoClaimsOverride) {
            // Create the brand eco-claim
            const [ecoClaim] = await testDb
                .insert(schema.brandEcoClaims)
                .values({
                    brandId,
                    claim,
                })
                .onConflictDoNothing()
                .returning({ id: schema.brandEcoClaims.id });

            let ecoClaimId = ecoClaim?.id;
            if (!ecoClaimId) {
                // Eco-claim already exists, find it
                const [existing] = await testDb
                    .select({ id: schema.brandEcoClaims.id })
                    .from(schema.brandEcoClaims)
                    .where(
                        and(
                            eq(schema.brandEcoClaims.brandId, brandId),
                            eq(schema.brandEcoClaims.claim, claim),
                        ),
                    )
                    .limit(1);
                ecoClaimId = existing?.id;
            }

            if (ecoClaimId) {
                await testDb.insert(schema.variantEcoClaims).values({
                    variantId,
                    ecoClaimId,
                });
            }
        }
    }

    // Create journey override if specified
    if (options.journeyStepsOverride && Object.keys(options.journeyStepsOverride).length > 0) {
        let sortIndex = 0;
        for (const [stepType, facilityName] of Object.entries(options.journeyStepsOverride)) {
            // Create the facility
            const [facility] = await testDb
                .insert(schema.brandFacilities)
                .values({
                    brandId,
                    displayName: facilityName,
                })
                .returning({ id: schema.brandFacilities.id });

            if (facility) {
                await testDb.insert(schema.variantJourneySteps).values({
                    variantId,
                    stepType,
                    facilityId: facility.id,
                    sortIndex,
                });
                sortIndex++;
            }
        }
    }

    return variantId;
}

/**
 * Creates a test export job.
 * Returns the export job ID.
 */
export async function createTestExportJob(
    brandId: string,
    userId: string,
    userEmail: string,
    options: CreateTestExportJobOptions = {},
): Promise<string> {
    const [job] = await testDb
        .insert(schema.exportJobs)
        .values({
            brandId,
            userId,
            userEmail,
            status: options.status ?? "PENDING",
            selectionMode: options.selectionMode ?? "all",
            includeIds: options.includeIds ?? [],
            excludeIds: options.excludeIds ?? [],
            filterState: options.filterState ?? null,
            searchQuery: options.searchQuery ?? null,
            totalProducts: options.totalProducts ?? 0,
            productsProcessed: options.productsProcessed ?? 0,
            filePath: options.filePath,
            downloadUrl: options.downloadUrl,
            expiresAt: options.expiresAt,
        })
        .returning({ id: schema.exportJobs.id });

    if (!job) {
        throw new Error("Failed to create test export job");
    }

    return job.id;
}

/**
 * Creates a test user for export testing.
 * Note: Creates in users table, not auth.users table (for testing purposes).
 * Returns the user ID.
 */
export async function createTestUser(email: string): Promise<string> {
    // Generate a UUID for the user
    const userId = crypto.randomUUID();

    // Insert into users table
    await testDb.insert(schema.users).values({
        id: userId,
        email,
    });

    return userId;
}
