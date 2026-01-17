"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import { VariantRow } from "./variant-row";
import type { VariantMetadata } from "@/components/forms/passport/blocks/variant-block";

interface ValueDisplay {
  name: string;
  hex: string | null;
}

interface EffectiveDimension {
  effectiveValues: string[];
  [key: string]: unknown;
}

interface MultiAttributeTableProps {
  /** First dimension (used for grouping) */
  firstDim: EffectiveDimension;
  /** First dimension index in effectiveDimensions array */
  firstDimIndex: number;
  /** Other dimensions (used for child rows) */
  otherDims: EffectiveDimension[];
  /** All effective dimensions */
  effectiveDimensions: EffectiveDimension[];
  /** Set of enabled variant keys */
  enabledVariantKeys: Set<string>;
  /** Function to get display info for a value at a given dimension index */
  getValueDisplay: (dimIndex: number, value: string) => ValueDisplay;
  /** Build key from values array */
  buildKey: (values: string[]) => string;
  /** Current variant metadata */
  variantMetadata: Record<string, VariantMetadata>;
  /** Update metadata callback */
  updateMetadata: (
    key: string,
    field: "sku" | "barcode",
    value: string,
  ) => void;
  /** Whether in edit mode */
  isEditMode: boolean;
  /** Saved variants map */
  savedVariants?: Map<
    string,
    {
      upid: string;
      hasOverrides: boolean;
      sku: string | null;
      barcode: string | null;
      attributeLabel: string;
    }
  >;
  /** Navigate to variant callback */
  navigateToVariant: (key: string) => void;
}

/**
 * Table for multi-dimension variants (accordion grouped).
 * Case 2+: When two or more dimensions have values.
 */
export function MultiAttributeTable({
  firstDim,
  firstDimIndex,
  otherDims,
  effectiveDimensions,
  enabledVariantKeys,
  getValueDisplay,
  buildKey,
  variantMetadata,
  updateMetadata,
  isEditMode,
  savedVariants,
  navigateToVariant,
}: MultiAttributeTableProps) {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  );

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
  const generateCombinations = (dims: EffectiveDimension[]): string[][] => {
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
                const isLastChild =
                  childIndex === childCombosForGroup.length - 1;
                const isVeryLastRow = isLastGroup && isLastChild;
                const fullCombo = [groupValue, ...combo];
                const key = buildKey(fullCombo);
                const meta = variantMetadata[key] ?? {};
                const sku = meta.sku ?? "";
                const barcode = meta.barcode ?? "";
                const savedVariant = savedVariants?.get(key);
                const isClickable = isEditMode && savedVariants?.has(key);
                // A variant is "new" if it's enabled but doesn't exist in savedVariants
                const isNewVariant = !savedVariants?.has(key);

                // Build label with names for each value in combo
                const labelParts = combo.map((val, i) => {
                  const otherDim = otherDims[i];
                  const otherDimIndex = otherDim
                    ? effectiveDimensions.indexOf(otherDim)
                    : -1;
                  const { name } = getValueDisplay(otherDimIndex, val);
                  return name;
                });

                return (
                  <VariantRow
                    key={key}
                    variantKey={key}
                    label={labelParts.join(" / ")}
                    isNew={isNewVariant}
                    hasOverrides={savedVariant?.hasOverrides ?? false}
                    sku={sku}
                    barcode={barcode}
                    onSkuChange={(val) => updateMetadata(key, "sku", val)}
                    onBarcodeChange={(val) =>
                      updateMetadata(key, "barcode", val)
                    }
                    isClickable={!!isClickable}
                    onClick={() => navigateToVariant(key)}
                    isLastRow={isVeryLastRow}
                  />
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
