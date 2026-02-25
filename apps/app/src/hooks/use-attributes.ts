import * as React from "react";
import { extractHex } from "@/utils/extract-hex";
import { useBrandCatalog } from "./use-brand-catalog";

export interface AttributeValueOption {
  id: string;
  name: string;
  hex: string | null;
  taxonomyValueId: string | null;
  sortOrder: number;
}

export interface UseAttributesParams {
  /** Brand attribute ID */
  brandAttributeId: string | null;
}

/**
 * Hook that provides brand-owned attribute value options for a given attribute.
 *
 * Runtime UI works exclusively with brand values. Taxonomy links (if any) are
 * passive provenance and metadata enrichment only.
 */
export function useAttributes({ brandAttributeId }: UseAttributesParams) {
  const { brandAttributeValuesByAttribute } = useBrandCatalog();

  const brandValues = React.useMemo(() => {
    if (!brandAttributeId) return [];
    return brandAttributeValuesByAttribute.get(brandAttributeId) ?? [];
  }, [brandAttributeId, brandAttributeValuesByAttribute]);

  const options = React.useMemo<AttributeValueOption[]>(() => {
    return [...brandValues]
      .map((value) => ({
        id: value.id,
        name: value.name,
        hex: extractHex(value.metadata),
        taxonomyValueId: value.taxonomyValueId,
        sortOrder: value.sortOrder ?? Number.POSITIVE_INFINITY,
      }))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });
  }, [brandValues]);

  const optionsById = React.useMemo(
    () => new Map(options.map((opt) => [opt.id, opt])),
    [options],
  );

  const getValueName = React.useCallback(
    (valueId: string): string => optionsById.get(valueId)?.name ?? valueId,
    [optionsById],
  );

  const getValueHex = React.useCallback(
    (valueId: string): string | null => optionsById.get(valueId)?.hex ?? null,
    [optionsById],
  );

  return {
    options,
    getValueName,
    getValueHex,
    brandValues,
    optionsById,
  };
}
