import * as React from "react";
import { useBrandCatalog } from "./use-brand-catalog";

/**
 * Represents an attribute value option that can be displayed in a select/popover.
 * Handles both brand-owned values and pending taxonomy values (not yet created as brand values).
 */
export interface AttributeValueOption {
  /**
   * Stable ID for selection.
   * - For brand values: the brand_attribute_values.id
   * - For uncovered taxonomy values: `tax:${taxonomy_values.id}`
   */
  id: string;
  /** Display name */
  name: string;
  /** Hex color from taxonomy metadata (if applicable) */
  hex: string | null;
  /** Whether this is an existing brand value (vs pending taxonomy value) */
  isBrandValue: boolean;
  /** The taxonomy value ID this is linked to (for sorting and hex lookup) */
  taxonomyValueId: string | null;
  /** Sort order for display (from taxonomy, or Infinity if custom) */
  sortOrder: number;
}

/**
 * Extracts hex color from taxonomy value metadata.
 * Checks both "swatch" and "hex" keys.
 */
function extractHex(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.swatch === "string") return m.swatch;
  if (typeof m.hex === "string") {
    return m.hex.startsWith("#") ? m.hex : `#${m.hex}`;
  }
  return null;
}

/**
 * Builds a deduplicated list of attribute value options from brand and taxonomy sources.
 *
 * Deduplication rule: If a brand value has a `taxonomyValueId`, that taxonomy value
 * is considered "covered" and won't appear separately in the list.
 *
 * @param brandAttributeId - The brand attribute ID to get values for
 * @param taxonomyAttributeId - The taxonomy attribute ID to get values from (null for custom attributes)
 * @param brandValues - Map of brand attribute ID -> brand values
 * @param taxonomyValues - Map of taxonomy attribute ID -> taxonomy values
 * @returns Sorted array of deduplicated options
 */
export function buildAttributeValueOptions(
  brandAttributeId: string | null,
  taxonomyAttributeId: string | null,
  brandValues: Map<
    string,
    { id: string; name: string; taxonomyValueId: string | null }[]
  >,
  taxonomyValues: Map<
    string,
    { id: string; name: string; sortOrder: number; metadata: unknown }[]
  >,
): AttributeValueOption[] {
  const options: AttributeValueOption[] = [];

  // Get brand values for this attribute
  const brandVals = brandAttributeId
    ? brandValues.get(brandAttributeId) ?? []
    : [];

  // Get taxonomy values for this attribute
  const taxVals = taxonomyAttributeId
    ? taxonomyValues.get(taxonomyAttributeId) ?? []
    : [];

  // Index taxonomy values for quick lookup
  const taxonomyById = new Map(taxVals.map((tv) => [tv.id, tv]));

  // Set of taxonomy value IDs that have a corresponding brand value (by ID link)
  const coveredTaxonomyIds = new Set<string>();

  // Set of value names that already exist as brand values (for name-based deduplication)
  // This prevents showing duplicate taxonomy values when a brand value with the same name
  // exists but wasn't linked to the taxonomy (e.g., created via integration or custom inline)
  const coveredNames = new Set<string>();

  // 1. Add all brand values
  for (const bv of brandVals) {
    const tv = bv.taxonomyValueId ? taxonomyById.get(bv.taxonomyValueId) : null;

    options.push({
      id: bv.id,
      name: bv.name,
      hex: tv ? extractHex(tv.metadata) : null,
      isBrandValue: true,
      taxonomyValueId: bv.taxonomyValueId,
      sortOrder: tv?.sortOrder ?? Number.POSITIVE_INFINITY,
    });

    // Mark taxonomy value as covered if linked
    if (bv.taxonomyValueId) {
      coveredTaxonomyIds.add(bv.taxonomyValueId);
    }

    // Also mark by name (case-insensitive) to prevent duplicates
    coveredNames.add(bv.name.toLowerCase());
  }

  // 2. Add uncovered taxonomy values (pending - not yet created as brand values)
  // A taxonomy value is "covered" if:
  // - There's a brand value explicitly linked to it (by taxonomyValueId), OR
  // - There's a brand value with the same name (case-insensitive)
  for (const tv of taxVals) {
    const isCoveredById = coveredTaxonomyIds.has(tv.id);
    const isCoveredByName = coveredNames.has(tv.name.toLowerCase());

    if (!isCoveredById && !isCoveredByName) {
      options.push({
        id: `tax:${tv.id}`,
        name: tv.name,
        hex: extractHex(tv.metadata),
        isBrandValue: false,
        taxonomyValueId: tv.id,
        sortOrder: tv.sortOrder,
      });
    }
  }

  // 3. Sort by sortOrder (sizes in logical order, etc.)
  return options.sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface UseAttributesParams {
  /** Brand attribute ID (null for uncreated attributes) */
  brandAttributeId: string | null;
  /** Taxonomy attribute ID (null for custom attributes) */
  taxonomyAttributeId: string | null;
}

/**
 * Hook that provides deduplicated attribute value options for a given attribute.
 *
 * Merges brand-owned values with uncovered taxonomy values, ensuring no duplicates
 * appear when a brand has already created values that link to taxonomy.
 *
 * @example
 * ```tsx
 * const { options, getValueName, getValueHex, hasTaxonomy } = useAttributes({
 *   brandAttributeId: dimension.attributeId,
 *   taxonomyAttributeId: dimension.taxonomyAttributeId,
 * });
 * ```
 */
export function useAttributes({
  brandAttributeId,
  taxonomyAttributeId,
}: UseAttributesParams) {
  const { taxonomyValuesByAttribute, brandAttributeValuesByAttribute } =
    useBrandCatalog();

  // Build deduplicated options
  const options = React.useMemo(() => {
    return buildAttributeValueOptions(
      brandAttributeId,
      taxonomyAttributeId,
      brandAttributeValuesByAttribute,
      taxonomyValuesByAttribute,
    );
  }, [
    brandAttributeId,
    taxonomyAttributeId,
    brandAttributeValuesByAttribute,
    taxonomyValuesByAttribute,
  ]);

  // Index for quick lookup
  const optionsById = React.useMemo(() => {
    return new Map(options.map((opt) => [opt.id, opt]));
  }, [options]);

  // Index taxonomy values by ID for fallback lookup
  const taxonomyValuesById = React.useMemo(() => {
    if (!taxonomyAttributeId)
      return new Map<string, { id: string; name: string; metadata: unknown }>();
    const values = taxonomyValuesByAttribute.get(taxonomyAttributeId) ?? [];
    return new Map(values.map((v) => [v.id, v]));
  }, [taxonomyAttributeId, taxonomyValuesByAttribute]);

  // Get display name for a value ID
  const getValueName = React.useCallback(
    (valueId: string): string => {
      // First try exact match in options
      const opt = optionsById.get(valueId);
      if (opt) return opt.name;

      // Fallback: if this is a tax:-prefixed value, look up the taxonomy value directly
      // This handles the transition period after save when the option list is refreshed
      // but the dimension values haven't been updated yet
      if (valueId.startsWith("tax:")) {
        const taxId = valueId.slice(4);
        const taxVal = taxonomyValuesById.get(taxId);
        if (taxVal) return taxVal.name;
      }

      return valueId;
    },
    [optionsById, taxonomyValuesById],
  );

  // Get hex color for a value ID
  const getValueHex = React.useCallback(
    (valueId: string): string | null => {
      // First try exact match in options
      const opt = optionsById.get(valueId);
      if (opt) return opt.hex;

      // Fallback: if this is a tax:-prefixed value, look up the taxonomy value directly
      if (valueId.startsWith("tax:")) {
        const taxId = valueId.slice(4);
        const taxVal = taxonomyValuesById.get(taxId);
        if (taxVal) {
          return extractHex(taxVal.metadata);
        }
      }

      return null;
    },
    [optionsById, taxonomyValuesById],
  );

  // Whether this attribute has taxonomy values (determines if modal is needed for creation)
  const hasTaxonomy = taxonomyAttributeId !== null;

  // Get taxonomy values directly (for CreateValueModal options)
  const taxonomyValues = React.useMemo(() => {
    if (!taxonomyAttributeId) return [];
    return taxonomyValuesByAttribute.get(taxonomyAttributeId) ?? [];
  }, [taxonomyAttributeId, taxonomyValuesByAttribute]);

  // Get brand values directly (for duplicate checking in CreateValueModal)
  const brandValues = React.useMemo(() => {
    if (!brandAttributeId) return [];
    return brandAttributeValuesByAttribute.get(brandAttributeId) ?? [];
  }, [brandAttributeId, brandAttributeValuesByAttribute]);

  return {
    /** Deduplicated attribute value options */
    options,
    /** Get display name for a value ID */
    getValueName,
    /** Get hex color for a value ID */
    getValueHex,
    /** Whether this attribute has taxonomy values (modal needed for custom value creation) */
    hasTaxonomy,
    /** Raw taxonomy values (for CreateValueModal) */
    taxonomyValues,
    /** Raw brand values (for duplicate checking) */
    brandValues,
    /** Index of options by ID */
    optionsById,
  };
}
