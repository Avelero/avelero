"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useRouter } from "next/navigation";
import * as React from "react";
import type {
  ExplicitVariant,
  VariantDimension,
  VariantMetadata,
} from "./types";

/**
 * Badge component to indicate a new variant that hasn't been saved yet.
 * Styled like TagLabel from tag-select.tsx
 */
function NewBadge() {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full border bg-background px-1.5 text-[12px] font-regular leading-none text-foreground flex-shrink-0">
      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-brand border-border" />
      New
    </span>
  );
}

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
  /** Saved variants with UPIDs and override status, keyed by the value id key (e.g., "valueId1|valueId2") */
  savedVariants?: Map<string, { upid: string; hasOverrides: boolean }>;
  /** 
   * Whether this is a new product (no saved variants yet).
   * - New product: Shows all enabled combinations from matrix (creation flow)
   * - Existing product: Shows ONLY variants that exist in savedVariants
   */
  isNewProduct?: boolean;
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
}: VariantTableProps) {
  const router = useRouter();
  const { taxonomyValuesByAttribute, brandAttributeValuesByAttribute } =
    useBrandCatalog();
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  );

  // Navigate to variant edit page (only in edit mode)
  const navigateToVariant = React.useCallback(
    (key: string) => {
      if (!isEditMode || !productHandle || !savedVariants) return;
      const variant = savedVariants.get(key);
      if (variant?.upid) {
        router.push(`/passports/edit/${productHandle}/variant/${variant.upid}`);
      }
    },
    [isEditMode, productHandle, savedVariants, router],
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

  // Get value display name and hex
  const getValueDisplay = (
    dimIndex: number,
    value: string,
    effectiveDims: typeof effectiveDimensions,
  ): { name: string; hex: string | null } => {
    const dim = effectiveDims[dimIndex];
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

  const updateMetadata = (
    key: string,
    field: "sku" | "barcode",
    value: string,
  ) => {
    setVariantMetadata((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  // Case 0: Explicit variants (imported without attributes)
  if (
    explicitVariants &&
    explicitVariants.length > 0 &&
    dimensions.length === 0
  ) {
    return (
      <div className="border-t border-border">
        <div className="grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] bg-accent-light border-b border-border">
          <div className="px-4 py-2 type-small text-secondary">Variant</div>
          <div className="px-4 py-2 type-small text-secondary">SKU</div>
          <div className="px-4 py-2 type-small text-secondary">Barcode</div>
        </div>
        {explicitVariants.map((variant, idx) => {
          // Use index-based key since array position is the stable identity
          // Using editable fields (sku/barcode) causes focus loss when transitioning from empty to non-empty
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Index is intentional - using editable fields (sku/barcode) causes focus loss when transitioning from empty to non-empty
              key={`variant-${idx}`}
              className="grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] h-10 border-b border-border"
            >
              <div className="px-4 flex items-center type-p text-primary">
                {variant.sku || variant.barcode || `Variant ${idx + 1}`}
              </div>
              <div
                className="border-l border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  value={variant.sku}
                  onChange={(e) => {
                    setExplicitVariants?.((prev) => {
                      const next = [...prev];
                      next[idx] = {
                        sku: e.target.value,
                        barcode: next[idx]?.barcode ?? "",
                      };
                      return next;
                    });
                  }}
                  placeholder="SKU"
                  className="h-full w-full rounded-none border-0 bg-transparent type-p px-4 focus-visible:ring-[1.5px] focus-visible:ring-brand"
                />
              </div>
              <div
                className="border-l border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  value={variant.barcode}
                  onChange={(e) => {
                    setExplicitVariants?.((prev) => {
                      const next = [...prev];
                      next[idx] = {
                        sku: next[idx]?.sku ?? "",
                        barcode: e.target.value,
                      };
                      return next;
                    });
                  }}
                  placeholder="Barcode"
                  className="h-full w-full rounded-none border-0 bg-transparent type-p px-4 focus-visible:ring-[1.5px] focus-visible:ring-brand"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Get effective values for each dimension
  const effectiveDimensions = dimensions.map((dim) => ({
    ...dim,
    effectiveValues: getDimensionValues(dim),
  }));

  // Filter to only dimensions that have values
  const dimensionsWithValues = effectiveDimensions.filter(
    (d) => d.effectiveValues.length > 0,
  );

  // No variants yet (no dimension has values)
  if (dimensionsWithValues.length === 0) {
    return null;
  }

  // Case 1: Only one dimension has values - flat list without checkboxes
  // When there's only one attribute, users can simply remove the attribute value
  // instead of using checkboxes. Checkboxes only make sense with 2+ attributes
  // where matrix combinations create variants users may want to selectively disable.
  if (dimensionsWithValues.length === 1) {
    const dim = dimensionsWithValues[0]!;
    const dimIndex = effectiveDimensions.indexOf(dim);

    // SIMPLIFIED: Always use enabledVariantKeys for display
    // savedVariants is only used for metadata lookup (UPID, hasOverrides)
    // This ensures new variants show up immediately when values are added
    const valuesToRender = dim.effectiveValues.filter((value) =>
      enabledVariantKeys.has(buildKey([value]))
    );

    if (valuesToRender.length === 0) {
      return null;
    }

    return (
      <div className="border-t border-border">
        <div className="grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] bg-accent-light border-b border-border">
          <div className="px-4 py-2 type-small text-secondary">Variant</div>
          <div className="px-4 py-2 type-small text-secondary">SKU</div>
          <div className="px-4 py-2 type-small text-secondary">Barcode</div>
        </div>
        {valuesToRender.map((value, valueIndex) => {
          const isLastRow = valueIndex === valuesToRender.length - 1;
          const key = buildKey([value]);
          const meta = variantMetadata[key] ?? {};
          const { name, hex } = getValueDisplay(
            dimIndex,
            value,
            effectiveDimensions,
          );
          const isClickable = isEditMode && savedVariants?.has(key);
          const savedVariant = savedVariants?.get(key);
          // A variant is "new" if it's enabled but doesn't exist in savedVariants
          const isNewVariant = !savedVariants?.has(key);

          return (
            <div
              key={key}
              className={cn(
                "grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] h-10 border-b border-border group",
                isClickable && "cursor-pointer hover:bg-accent",
                isLastRow && "border-b-0",
              )}
              onClick={isClickable ? () => navigateToVariant(key) : undefined}
            >
              <div className="px-4 flex items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {hex && (
                    <div
                      className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: hex }}
                    />
                  )}
                  <span
                    className={cn(
                      "type-p text-primary truncate",
                      isClickable && "group-hover:underline",
                    )}
                  >
                    {name}
                  </span>
                  {/* New variant indicator */}
                  {isNewVariant && <NewBadge />}
                  {/* Override indicator */}
                  {savedVariant?.hasOverrides && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            <div className="w-2 h-2 rounded-full bg-brand" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Contains variant-specific overrides
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              <div
                className="border-l border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  value={meta.sku ?? ""}
                  onChange={(e) => updateMetadata(key, "sku", e.target.value)}
                  placeholder="SKU"
                  className="h-full w-full rounded-none border-0 bg-transparent type-p px-4 focus-visible:ring-[1.5px] focus-visible:ring-brand"
                />
              </div>
              <div
                className="border-l border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  value={meta.barcode ?? ""}
                  onChange={(e) =>
                    updateMetadata(key, "barcode", e.target.value)
                  }
                  placeholder="Barcode"
                  className="h-full w-full rounded-none border-0 bg-transparent type-p px-4 focus-visible:ring-[1.5px] focus-visible:ring-brand"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Case 2+: Multiple dimensions with values - accordion grouped by first dimension with values
  const firstDim = dimensionsWithValues[0]!;
  const firstDimIndex = effectiveDimensions.indexOf(firstDim);
  const otherDims = dimensionsWithValues.slice(1);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Generate cartesian product for other dimensions (used for new products)
  const generateCombinations = (
    dims: typeof dimensionsWithValues,
  ): string[][] => {
    if (dims.length === 0) return [[]];
    const [first, ...rest] = dims;
    const restCombos = generateCombinations(rest);
    const result: string[][] = [];
    for (const value of first!.effectiveValues) {
      for (const combo of restCombos) {
        result.push([value, ...combo]);
      }
    }
    return result;
  };

  // Get all combinations that should be shown based on product state
  const allChildCombinations = generateCombinations(otherDims);

  // SIMPLIFIED LOGIC: Always use enabledVariantKeys for display
  // savedVariants is only used for metadata lookup (UPID, hasOverrides)
  // This ensures new variants show up immediately when values are added

  // Determine which first-dimension values to show
  // Show groups that have at least one enabled combination
  const groupValuesToShow = firstDim.effectiveValues.filter((value) => {
    return allChildCombinations.some((combo) => {
      const fullCombo = [value, ...combo];
      return enabledVariantKeys.has(buildKey(fullCombo));
    });
  });

  if (groupValuesToShow.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border">
      <div className="grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] bg-accent-light border-b border-border">
        <div className="px-4 py-2 type-small text-secondary">Variant</div>
        <div className="px-4 py-2 type-small text-secondary">SKU</div>
        <div className="px-4 py-2 type-small text-secondary">Barcode</div>
      </div>

      {groupValuesToShow.map((groupValue, groupIndex) => {
        const isLastGroup = groupIndex === groupValuesToShow.length - 1;
        const isExpanded = expandedGroups.has(groupValue);
        const { name: groupName, hex: groupHex } = getValueDisplay(
          firstDimIndex,
          groupValue,
          effectiveDimensions,
        );
        const groupKey = buildKey([groupValue]);

        // Get child combinations for this group - ALWAYS use enabledVariantKeys
        const childCombosForGroup = allChildCombinations.filter((combo) => {
          const fullCombo = [groupValue, ...combo];
          return enabledVariantKeys.has(buildKey(fullCombo));
        });

        const variantCount = childCombosForGroup.length;

        // Skip groups with no variants
        if (variantCount === 0) {
          return null;
        }

        return (
          <div key={groupKey}>
            {/* Group header row */}
            <button
              type="button"
              onClick={() => toggleGroup(groupValue)}
              className={cn(
                "w-full h-10 hover:bg-accent transition-colors text-left px-4 py-2 flex items-center gap-2 border-b border-border",
                // Remove border on last group header when collapsed (no children shown)
                isLastGroup && !isExpanded && "border-b-0",
              )}
            >
              <Icons.ChevronDown
                className={`h-4 w-4 text-tertiary transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
              {groupHex && (
                <div
                  className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: groupHex }}
                />
              )}
              <span className="type-p text-primary">{groupName}</span>
              <span className="type-small text-tertiary">
                {variantCount} variant{variantCount !== 1 ? "s" : ""}
              </span>
            </button>

            {/* Child rows */}
            {isExpanded &&
              childCombosForGroup.map((combo, childIndex) => {
                const isLastChild = childIndex === childCombosForGroup.length - 1;
                const isVeryLastRow = isLastGroup && isLastChild;
                const fullCombo = [groupValue, ...combo];
                const key = buildKey(fullCombo);
                const meta = variantMetadata[key] ?? {};
                const savedVariant = savedVariants?.get(key);
                const isClickable = isEditMode && savedVariants?.has(key);
                // A variant is "new" if it's enabled but doesn't exist in savedVariants
                const isNewVariant = !savedVariants?.has(key);

                // Build label with hex colors for each value in combo
                const labelParts = combo.map((val, i) => {
                  const otherDim = otherDims[i];
                  const otherDimIndex = otherDim
                    ? effectiveDimensions.indexOf(otherDim)
                    : -1;
                  const { name, hex } = getValueDisplay(
                    otherDimIndex,
                    val,
                    effectiveDimensions,
                  );
                  return { name, hex, value: val };
                });

                return (
                  <div
                    key={key}
                    className={cn(
                      "grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] h-10 border-b border-border group",
                      isClickable && "cursor-pointer hover:bg-accent",
                      // Remove border on the very last row
                      isVeryLastRow && "border-b-0",
                    )}
                    onClick={
                      isClickable
                        ? () => navigateToVariant(key)
                        : undefined
                    }
                  >
                    <div className="px-4 flex items-center gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "type-p text-primary truncate",
                            isClickable && "group-hover:underline",
                          )}
                        >
                          {labelParts.map((part) => part.name).join(" / ")}
                        </span>
                        {/* New variant indicator */}
                        {isNewVariant && <NewBadge />}
                        {/* Override indicator */}
                        {savedVariant?.hasOverrides && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                  <div className="w-2 h-2 rounded-full bg-brand" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Contains variant-specific overrides
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                    <div
                      className="border-l border-border"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={meta.sku ?? ""}
                        onChange={(e) =>
                          updateMetadata(key, "sku", e.target.value)
                        }
                        placeholder="SKU"
                        className="h-full w-full rounded-none border-0 bg-transparent type-p px-4 focus-visible:ring-[1.5px] focus-visible:ring-brand"
                      />
                    </div>
                    <div
                      className="border-l border-border"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={meta.barcode ?? ""}
                        onChange={(e) =>
                          updateMetadata(key, "barcode", e.target.value)
                        }
                        placeholder="Barcode"
                        className="h-full w-full rounded-none border-0 bg-transparent type-p px-4 focus-visible:ring-[1.5px] focus-visible:ring-brand"
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
