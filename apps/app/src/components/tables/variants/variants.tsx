"use client";

import type {
  ExplicitVariant,
  VariantDimension,
  VariantMetadata,
} from "@/components/forms/passport/blocks/variant-block";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { useRouter } from "next/navigation";
import * as React from "react";
import { MultiAttributeTable } from "./multi-attribute";
import { NoAttributesTable } from "./no-attributes";
import { SingleAttributeTable } from "./single-attribute";

interface VariantTableProps {
  dimensions: VariantDimension[];
  variantMetadata: Record<string, VariantMetadata>;
  setVariantMetadata: React.Dispatch<
    React.SetStateAction<Record<string, VariantMetadata>>
  >;
  explicitVariants?: ExplicitVariant[];
  setExplicitVariants?: React.Dispatch<React.SetStateAction<ExplicitVariant[]>>;
  /** Set of pipe-separated value ID keys that are enabled */
  enabledVariantKeys: Set<string>;
  /** Whether in edit mode (variants are clickable and navigate to variant edit page) */
  isEditMode?: boolean;
  /** Product handle for building variant edit URLs */
  productHandle?: string;
  /** Saved variants with IDs, UPIDs, override status, and metadata, keyed by the value id key (e.g., "valueId1|valueId2") */
  savedVariants?: Map<
    string,
    {
      id: string;
      upid: string;
      hasOverrides: boolean;
      sku: string | null;
      barcode: string | null;
      attributeLabel: string;
    }
  >;
  /**
   * Whether this is a new product (no saved variants yet).
   * - New product: Shows all enabled combinations from matrix (creation flow)
   * - Existing product: Shows ONLY variants that exist in savedVariants
   */
  isNewProduct?: boolean;
  /**
   * Optional callback for navigation. If provided, will be called instead of direct router.push.
   * This allows the parent to intercept navigation and show unsaved changes modal.
   */
  onNavigateToVariant?: (url: string) => void;
}

export function VariantTable({
  dimensions,
  variantMetadata,
  setVariantMetadata,
  explicitVariants,
  setExplicitVariants,
  enabledVariantKeys,
  isEditMode = false,
  productHandle,
  savedVariants,
  isNewProduct = false,
  onNavigateToVariant,
}: VariantTableProps) {
  const router = useRouter();
  const { taxonomyValuesByAttribute, brandAttributeValuesByAttribute } =
    useBrandCatalog();

  // Navigate to variant edit page (only in edit mode)
  const navigateToVariant = React.useCallback(
    (key: string) => {
      if (!isEditMode || !productHandle || !savedVariants) return;
      const variant = savedVariants.get(key);
      if (variant?.upid) {
        const url = `/passports/edit/${productHandle}/variant/${variant.upid}`;
        if (onNavigateToVariant) {
          // Use the parent's navigation handler (goes through navigation blocker)
          onNavigateToVariant(url);
        } else {
          // Direct navigation (legacy behavior)
          router.push(url);
        }
      }
    },
    [isEditMode, productHandle, savedVariants, router, onNavigateToVariant],
  );

  // Get values array for a dimension (handles both standard and custom inline)
  const getDimensionValues = (dim: VariantDimension): string[] => {
    if (dim.isCustomInline) {
      // Custom inline values are raw strings; ignore empty placeholders
      return (dim.customValues ?? []).map((v) => v.trim()).filter(Boolean);
    }
    // Standard attributes: values are brand value IDs
    return dim.values ?? [];
  };

  // Get hex color for a taxonomy value (check both "swatch" and "hex" keys)
  const getTaxonomyValueHex = (
    dim: VariantDimension,
    valueId: string,
  ): string | null => {
    if (dim.isCustomInline || !dim.taxonomyAttributeId) return null;

    const taxValues =
      taxonomyValuesByAttribute.get(dim.taxonomyAttributeId) ?? [];
    const taxVal = taxValues.find((v) => v.id === valueId);

    if (taxVal?.metadata && typeof taxVal.metadata === "object") {
      const meta = taxVal.metadata as Record<string, unknown>;
      if (typeof meta.swatch === "string") return meta.swatch;
      if (typeof meta.hex === "string")
        return meta.hex.startsWith("#") ? meta.hex : `#${meta.hex}`;
    }
    return null;
  };

  // Get hex color from a taxonomy value ID
  const getHexFromTaxonomyValueId = (
    taxonomyAttributeId: string,
    taxonomyValueId: string,
  ): string | null => {
    const taxValues = taxonomyValuesByAttribute.get(taxonomyAttributeId) ?? [];
    const taxVal = taxValues.find((v) => v.id === taxonomyValueId);
    if (taxVal?.metadata && typeof taxVal.metadata === "object") {
      const meta = taxVal.metadata as Record<string, unknown>;
      if (typeof meta.swatch === "string") return meta.swatch;
      if (typeof meta.hex === "string")
        return meta.hex.startsWith("#") ? meta.hex : `#${meta.hex}`;
    }
    return null;
  };

  // Get effective values for each dimension
  const effectiveDimensions = dimensions.map((dim) => ({
    ...dim,
    effectiveValues: getDimensionValues(dim),
  }));

  // Get value display name and hex
  const getValueDisplay = (
    dimIndex: number,
    value: string,
  ): { name: string; hex: string | null } => {
    const dim = effectiveDimensions[dimIndex];
    if (!dim) return { name: value, hex: null };

    // Custom inline - value is the string itself
    if (dim.isCustomInline) {
      return { name: value, hex: null };
    }

    // Handle tax:-prefixed values (pending taxonomy values not yet created as brand values)
    if (value.startsWith("tax:") && dim.taxonomyAttributeId) {
      const taxId = value.slice(4);
      const taxValues =
        taxonomyValuesByAttribute.get(dim.taxonomyAttributeId) ?? [];
      const taxVal = taxValues.find((v) => v.id === taxId);
      if (taxVal) {
        let hex: string | null = null;
        if (taxVal.metadata && typeof taxVal.metadata === "object") {
          const meta = taxVal.metadata as Record<string, unknown>;
          if (typeof meta.swatch === "string") hex = meta.swatch;
          else if (typeof meta.hex === "string")
            hex = meta.hex.startsWith("#") ? meta.hex : `#${meta.hex}`;
        }
        return { name: taxVal.name, hex };
      }
      // Fallback if taxonomy value not found
      return { name: value, hex: null };
    }

    // Always check brand values first - dimension.values contains brand value IDs
    if (dim.attributeId) {
      const brandValues =
        brandAttributeValuesByAttribute.get(dim.attributeId) ?? [];
      const brandVal = brandValues.find((v) => v.id === value);
      if (brandVal) {
        // Get hex from linked taxonomy value if available
        const hex =
          brandVal.taxonomyValueId && dim.taxonomyAttributeId
            ? getHexFromTaxonomyValueId(
                dim.taxonomyAttributeId,
                brandVal.taxonomyValueId,
              )
            : null;
        return { name: brandVal.name, hex };
      }
    }

    // Fallback to direct taxonomy value lookup (legacy compatibility)
    if (dim.taxonomyAttributeId) {
      const taxValues =
        taxonomyValuesByAttribute.get(dim.taxonomyAttributeId) ?? [];
      const taxVal = taxValues.find((v) => v.id === value);
      if (taxVal) {
        return { name: taxVal.name, hex: getTaxonomyValueHex(dim, value) };
      }
    }

    return { name: value, hex: null };
  };

  const buildKey = (values: string[]) => values.join("|");

  // Update metadata directly via the prop setter
  const updateMetadata = React.useCallback(
    (key: string, field: "sku" | "barcode", value: string) => {
      setVariantMetadata((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        },
      }));
    },
    [setVariantMetadata],
  );

  // Case 0: Explicit variants (imported without attributes)
  if (
    explicitVariants &&
    explicitVariants.length > 0 &&
    dimensions.length === 0
  ) {
    return (
      <NoAttributesTable
        explicitVariants={explicitVariants}
        setExplicitVariants={setExplicitVariants!}
      />
    );
  }

  // Filter to only dimensions that have values
  const dimensionsWithValues = effectiveDimensions.filter(
    (d) => d.effectiveValues.length > 0,
  );

  // No variants yet (no dimension has values)
  if (dimensionsWithValues.length === 0) {
    return null;
  }

  // Case 1: Only one dimension has values - flat list without checkboxes
  if (dimensionsWithValues.length === 1) {
    const dim = dimensionsWithValues[0]!;
    const dimIndex = effectiveDimensions.indexOf(dim);

    // SIMPLIFIED: Always use enabledVariantKeys for display
    const valuesToRender = dim.effectiveValues.filter((value) =>
      enabledVariantKeys.has(buildKey([value])),
    );

    if (valuesToRender.length === 0) {
      return null;
    }

    return (
      <SingleAttributeTable
        valuesToRender={valuesToRender}
        getValueDisplay={(value) => getValueDisplay(dimIndex, value)}
        buildKey={buildKey}
        variantMetadata={variantMetadata}
        updateMetadata={updateMetadata}
        isEditMode={isEditMode}
        savedVariants={savedVariants}
        navigateToVariant={navigateToVariant}
        enabledVariantKeys={enabledVariantKeys}
      />
    );
  }

  // Case 2+: Multiple dimensions with values - accordion grouped by first dimension
  const firstDim = dimensionsWithValues[0]!;
  const firstDimIndex = effectiveDimensions.indexOf(firstDim);
  const otherDims = dimensionsWithValues.slice(1);

  return (
    <MultiAttributeTable
      firstDim={firstDim}
      firstDimIndex={firstDimIndex}
      otherDims={otherDims}
      effectiveDimensions={effectiveDimensions}
      enabledVariantKeys={enabledVariantKeys}
      getValueDisplay={getValueDisplay}
      buildKey={buildKey}
      variantMetadata={variantMetadata}
      updateMetadata={updateMetadata}
      isEditMode={isEditMode}
      savedVariants={savedVariants}
      navigateToVariant={navigateToVariant}
    />
  );
}
