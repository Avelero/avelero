"use client";

import * as React from "react";
import { VariantRow } from "./variant-row";
import type { VariantMetadata } from "@/components/forms/passport/blocks/variant-block";

interface ValueDisplay {
  name: string;
  hex: string | null;
}

interface SingleAttributeTableProps {
  /** Values to render (from the single dimension) */
  valuesToRender: string[];
  /** Function to get display info for a value */
  getValueDisplay: (value: string) => ValueDisplay;
  /** Build key from values array */
  buildKey: (values: string[]) => string;
  /** Current variant metadata (fallback for values not yet in hook) */
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
 * Table for single-dimension variants (flat list).
 * Case 1: When only one dimension has values.
 */
export function SingleAttributeTable({
  valuesToRender,
  getValueDisplay,
  buildKey,
  variantMetadata,
  updateMetadata,
  isEditMode,
  savedVariants,
  navigateToVariant,
}: SingleAttributeTableProps) {
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
        const sku = meta.sku ?? "";
        const barcode = meta.barcode ?? "";
        const { name, hex } = getValueDisplay(value);
        const isClickable = isEditMode && savedVariants?.has(key);
        const savedVariant = savedVariants?.get(key);
        // A variant is "new" if it's enabled but doesn't exist in savedVariants
        const isNewVariant = !savedVariants?.has(key);

        return (
          <VariantRow
            key={key}
            variantKey={key}
            label={name}
            hex={hex}
            isNew={isNewVariant}
            hasOverrides={savedVariant?.hasOverrides ?? false}
            sku={sku}
            barcode={barcode}
            onSkuChange={(val) => updateMetadata(key, "sku", val)}
            onBarcodeChange={(val) => updateMetadata(key, "barcode", val)}
            isClickable={!!isClickable}
            onClick={() => navigateToVariant(key)}
            isLastRow={isLastRow}
          />
        );
      })}
    </div>
  );
}
