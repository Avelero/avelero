/**
 * Variant utilities shared across passport form and variant table flows.
 */

export interface VariantDimensionLike {
  values?: string[];
  isCustomInline?: boolean;
  customValues?: string[] | null;
}

/**
 * Returns the active values for a dimension, including custom inline values.
 */
export function getEffectiveVariantValues(
  dimension: VariantDimensionLike,
): string[] {
  if (dimension.isCustomInline) {
    return (dimension.customValues ?? []).map((value) => value.trim()).filter(Boolean);
  }

  return dimension.values ?? [];
}

/**
 * Reports whether a dimension currently contributes any variant values.
 */
export function variantDimensionHasValues(
  dimension: VariantDimensionLike,
): boolean {
  return getEffectiveVariantValues(dimension).length > 0;
}

/**
 * Generates ordered pipe-joined combination keys for all dimension values.
 */
export function generateVariantCombinationKeys(
  dimensions: VariantDimensionLike[],
): string[] {
  const effectiveDimensions = dimensions
    .map((dimension) => getEffectiveVariantValues(dimension))
    .filter((values) => values.length > 0);

  if (effectiveDimensions.length === 0) {
    return [];
  }

  /**
   * Builds the cartesian product for the supplied dimension values.
   */
  const generateCombinations = (valuesByDimension: string[][]): string[][] => {
    if (valuesByDimension.length === 0) {
      return [[]];
    }

    const [firstValues, ...restValues] = valuesByDimension;
    const restCombinations = generateCombinations(restValues);
    const combinations: string[][] = [];

    for (const value of firstValues ?? []) {
      for (const combination of restCombinations) {
        combinations.push([value, ...combination]);
      }
    }

    return combinations;
  };

  return generateCombinations(effectiveDimensions).map((values) =>
    values.join("|"),
  );
}

/**
 * Returns enabled variant keys in stable table order.
 */
export function getOrderedEnabledVariantKeys(
  dimensions: VariantDimensionLike[],
  enabledVariantKeys: Iterable<string>,
): string[] {
  const enabledKeySet = new Set(enabledVariantKeys);

  return generateVariantCombinationKeys(dimensions).filter((key) =>
    enabledKeySet.has(key),
  );
}

/**
 * Builds the display label for a no-attribute variant row.
 */
export function getNoAttributeVariantLabel(params: {
  index: number;
  total: number;
  productName?: string | null;
}): string {
  const { index, total, productName } = params;

  if (total === 1) {
    return productName?.trim() || "Variant 1";
  }

  return `Variant ${index + 1}`;
}
