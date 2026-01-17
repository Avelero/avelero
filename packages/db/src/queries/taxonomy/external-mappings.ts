import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import { taxonomyExternalMappings } from "../../schema";

/**
 * Get a taxonomy external mapping by its slug.
 *
 * @param db - Database connection
 * @param slug - Unique mapping slug (e.g., "shopify-to-avelero")
 * @returns The mapping row or null if not found
 */
export async function getTaxonomyExternalMappingBySlug(
  db: Database,
  slug: string,
) {
  const [row] = await db
    .select({
      id: taxonomyExternalMappings.id,
      slug: taxonomyExternalMappings.slug,
      sourceSystem: taxonomyExternalMappings.sourceSystem,
      sourceTaxonomy: taxonomyExternalMappings.sourceTaxonomy,
      targetTaxonomy: taxonomyExternalMappings.targetTaxonomy,
      version: taxonomyExternalMappings.version,
      data: taxonomyExternalMappings.data,
      createdAt: taxonomyExternalMappings.createdAt,
      updatedAt: taxonomyExternalMappings.updatedAt,
    })
    .from(taxonomyExternalMappings)
    .where(eq(taxonomyExternalMappings.slug, slug))
    .limit(1);

  return row ?? null;
}
