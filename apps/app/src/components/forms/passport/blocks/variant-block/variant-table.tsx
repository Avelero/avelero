"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { cn } from "@v1/ui/cn";
import * as React from "react";
import type { ExplicitVariant, VariantDimension, VariantMetadata } from "./types";

interface VariantTableProps {
  dimensions: VariantDimension[];
  variantMetadata: Record<string, VariantMetadata>;
  setVariantMetadata: React.Dispatch<React.SetStateAction<Record<string, VariantMetadata>>>;
  explicitVariants?: ExplicitVariant[];
  setExplicitVariants?: React.Dispatch<React.SetStateAction<ExplicitVariant[]>>;
  /** Set of pipe-separated value ID keys that are enabled */
  enabledVariantKeys: Set<string>;
  /** Setter for updating enabled variant keys */
  setEnabledVariantKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * Checkbox component styled to match the passports table.
 */
function VariantCheckbox({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label
      className="relative inline-flex h-3.5 w-3.5 items-center justify-center cursor-pointer shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        aria-label={ariaLabel}
        className="block h-3.5 w-3.5 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer outline-none focus:outline-none"
        checked={checked}
        onChange={(e) => {
          (e.target as HTMLInputElement).blur();
          onChange(e.target.checked);
        }}
      />
      {checked && (
        <div className="absolute top-0 left-0 w-3.5 h-3.5 flex items-center justify-center pointer-events-none">
          <div className="w-[8px] h-[8px] bg-brand" />
        </div>
      )}
    </label>
  );
}

export function VariantTable({
  dimensions,
  variantMetadata,
  setVariantMetadata,
  explicitVariants,
  setExplicitVariants,
  enabledVariantKeys,
  setEnabledVariantKeys,
}: VariantTableProps) {
  const { taxonomyValuesByAttribute, brandAttributeValuesByAttribute } = useBrandCatalog();
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  // Toggle a variant's enabled state
  const toggleVariantEnabled = (key: string, enabled: boolean) => {
    setEnabledVariantKeys((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

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
  const getTaxonomyValueHex = (dim: VariantDimension, valueId: string): string | null => {
    if (dim.isCustomInline || !dim.taxonomyAttributeId) return null;

    const taxValues = taxonomyValuesByAttribute.get(dim.taxonomyAttributeId) ?? [];
    const taxVal = taxValues.find((v) => v.id === valueId);

    if (taxVal?.metadata && typeof taxVal.metadata === "object") {
      const meta = taxVal.metadata as Record<string, unknown>;
      if (typeof meta.swatch === "string") return meta.swatch;
      if (typeof meta.hex === "string") return meta.hex.startsWith("#") ? meta.hex : `#${meta.hex}`;
    }
    return null;
  };

  // Get hex color from a taxonomy value ID
  const getHexFromTaxonomyValueId = (taxonomyAttributeId: string, taxonomyValueId: string): string | null => {
    const taxValues = taxonomyValuesByAttribute.get(taxonomyAttributeId) ?? [];
    const taxVal = taxValues.find((v) => v.id === taxonomyValueId);
    if (taxVal?.metadata && typeof taxVal.metadata === "object") {
      const meta = taxVal.metadata as Record<string, unknown>;
      if (typeof meta.swatch === "string") return meta.swatch;
      if (typeof meta.hex === "string") return meta.hex.startsWith("#") ? meta.hex : `#${meta.hex}`;
    }
    return null;
  };

  // Get value display name and hex
  const getValueDisplay = (dimIndex: number, value: string, effectiveDims: typeof effectiveDimensions): { name: string; hex: string | null } => {
    const dim = effectiveDims[dimIndex];
    if (!dim) return { name: value, hex: null };

    // Custom inline - value is the string itself
    if (dim.isCustomInline) {
      return { name: value, hex: null };
    }

    // Always check brand values first - dimension.values contains brand value IDs
    if (dim.attributeId) {
      const brandValues = brandAttributeValuesByAttribute.get(dim.attributeId) ?? [];
      const brandVal = brandValues.find((v) => v.id === value);
      if (brandVal) {
        // Get hex from linked taxonomy value if available
        const hex = brandVal.taxonomyValueId && dim.taxonomyAttributeId
          ? getHexFromTaxonomyValueId(dim.taxonomyAttributeId, brandVal.taxonomyValueId)
          : null;
        return { name: brandVal.name, hex };
      }
    }

    // Fallback to direct taxonomy value lookup (legacy compatibility)
    if (dim.taxonomyAttributeId) {
      const taxValues = taxonomyValuesByAttribute.get(dim.taxonomyAttributeId) ?? [];
      const taxVal = taxValues.find((v) => v.id === value);
      if (taxVal) {
        return { name: taxVal.name, hex: getTaxonomyValueHex(dim, value) };
      }
    }

    return { name: value, hex: null };
  };

  const buildKey = (values: string[]) => values.join("|");

  const updateMetadata = (key: string, field: "sku" | "barcode", value: string) => {
    setVariantMetadata((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  // Case 0: Explicit variants (imported without attributes)
  if (explicitVariants && explicitVariants.length > 0 && dimensions.length === 0) {
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
              className="grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] border-b border-border"
            >
              <div className="px-4 py-2 type-p text-primary">
                {variant.sku || variant.barcode || `Variant ${idx + 1}`}
              </div>
              <div className="px-2 py-1.5 border-l border-border">
                <Input
                  value={variant.sku}
                  onChange={(e) => {
                    setExplicitVariants?.((prev) => {
                      const next = [...prev];
                      next[idx] = { sku: e.target.value, barcode: next[idx]?.barcode ?? "" };
                      return next;
                    });
                  }}
                  placeholder="SKU"
                  className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                />
              </div>
              <div className="px-2 py-1.5 border-l border-border">
                <Input
                  value={variant.barcode}
                  onChange={(e) => {
                    setExplicitVariants?.((prev) => {
                      const next = [...prev];
                      next[idx] = { sku: next[idx]?.sku ?? "", barcode: e.target.value };
                      return next;
                    });
                  }}
                  placeholder="Barcode"
                  className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
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
  const dimensionsWithValues = effectiveDimensions.filter((d) => d.effectiveValues.length > 0);

  // No variants yet (no dimension has values)
  if (dimensionsWithValues.length === 0) {
    return null;
  }

  // Case 1: Only one dimension has values - flat list (even if there are more dimensions defined)
  if (dimensionsWithValues.length === 1) {
    const dim = dimensionsWithValues[0]!;
    const dimIndex = effectiveDimensions.indexOf(dim);
    return (
      <div className="border-t border-border">
        <div className="grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] bg-accent-light border-b border-border">
          <div className="px-4 py-2 type-small text-secondary">Variant</div>
          <div className="px-4 py-2 type-small text-secondary">SKU</div>
          <div className="px-4 py-2 type-small text-secondary">Barcode</div>
        </div>
        {dim.effectiveValues.map((value) => {
          const key = buildKey([value]);
          const meta = variantMetadata[key] ?? {};
          const { name, hex } = getValueDisplay(dimIndex, value, effectiveDimensions);
          const isEnabled = enabledVariantKeys.has(key);
          return (
            <div
              key={key}
              className={cn(
                "grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] border-b border-border",
                !isEnabled && "opacity-50"
              )}
            >
              <div className="px-4 py-2 flex items-center gap-2">
                <VariantCheckbox
                  checked={isEnabled}
                  onChange={(checked) => toggleVariantEnabled(key, checked)}
                  ariaLabel={`Enable variant ${name}`}
                />
                {hex && (
                  <div
                    className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                )}
                <span className="type-p text-primary">{name}</span>
              </div>
              <div className="px-2 py-1.5 border-l border-border">
                <Input
                  value={meta.sku ?? ""}
                  onChange={(e) => updateMetadata(key, "sku", e.target.value)}
                  placeholder="SKU"
                  className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                  disabled={!isEnabled}
                />
              </div>
              <div className="px-2 py-1.5 border-l border-border">
                <Input
                  value={meta.barcode ?? ""}
                  onChange={(e) => updateMetadata(key, "barcode", e.target.value)}
                  placeholder="Barcode"
                  className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                  disabled={!isEnabled}
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

  // Generate cartesian product for other dimensions
  const generateCombinations = (dims: typeof dimensionsWithValues): string[][] => {
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

  const childCombinations = generateCombinations(otherDims);

  return (
    <div className="border-t border-border">
      <div className="grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] bg-accent-light border-b border-border">
        <div className="px-4 py-2 type-small text-secondary">Variant</div>
        <div className="px-4 py-2 type-small text-secondary">SKU</div>
        <div className="px-4 py-2 type-small text-secondary">Barcode</div>
      </div>

      {firstDim.effectiveValues.map((groupValue) => {
        const isExpanded = expandedGroups.has(groupValue);
        const { name: groupName, hex: groupHex } = getValueDisplay(firstDimIndex, groupValue, effectiveDimensions);
        const groupKey = buildKey([groupValue]);

        // Count enabled variants within this group
        const enabledInGroup = childCombinations.filter((combo) => {
          const fullCombo = [groupValue, ...combo];
          return enabledVariantKeys.has(buildKey(fullCombo));
        }).length;
        const totalInGroup = childCombinations.length;

        return (
          <div key={groupKey}>
            {/* Group header row */}
            <button
              type="button"
              onClick={() => toggleGroup(groupValue)}
              className="w-full h-10 hover:bg-accent transition-colors text-left px-4 py-2 flex items-center gap-2 border-b border-border"
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
                {enabledInGroup === totalInGroup
                  ? `${totalInGroup} variants`
                  : `${enabledInGroup}/${totalInGroup} variants`}
              </span>
            </button>

            {/* Child rows */}
            {isExpanded &&
              childCombinations.map((combo) => {
                const fullCombo = [groupValue, ...combo];
                const key = buildKey(fullCombo);
                const meta = variantMetadata[key] ?? {};
                const isEnabled = enabledVariantKeys.has(key);

                // Build label with hex colors for each value in combo
                const labelParts = combo.map((val, i) => {
                  const otherDim = otherDims[i];
                  const otherDimIndex = otherDim ? effectiveDimensions.indexOf(otherDim) : -1;
                  const { name, hex } = getValueDisplay(otherDimIndex, val, effectiveDimensions);
                  return { name, hex, value: val };
                });

                return (
                  <div
                    key={key}
                    className={cn(
                      "grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] border-b border-border",
                      !isEnabled && "opacity-50"
                    )}
                  >
                    <div className="px-4 py-2 flex items-center gap-2">
                      <div className="flex items-center mx-[1px]">
                        <VariantCheckbox
                          checked={isEnabled}
                          onChange={(checked) => toggleVariantEnabled(key, checked)}
                          ariaLabel={`Enable variant ${labelParts.map((p) => p.name).join(" / ")}`}
                        />
                      </div>
                      {labelParts.map((part, i) => (
                        <React.Fragment key={`${part.value}-${i}`}>
                          {i > 0 && <span className="type-p text-tertiary">/</span>}
                          {part.hex && (
                            <div
                              className="h-3 w-3 rounded-full border border-border shrink-0"
                              style={{ backgroundColor: part.hex }}
                            />
                          )}
                          <span className="type-p text-primary">{part.name}</span>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="px-2 py-1.5 border-l border-border">
                      <Input
                        value={meta.sku ?? ""}
                        onChange={(e) => updateMetadata(key, "sku", e.target.value)}
                        placeholder="SKU"
                        className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                        disabled={!isEnabled}
                      />
                    </div>
                    <div className="px-2 py-1.5 border-l border-border">
                      <Input
                        value={meta.barcode ?? ""}
                        onChange={(e) => updateMetadata(key, "barcode", e.target.value)}
                        placeholder="Barcode"
                        className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                        disabled={!isEnabled}
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
