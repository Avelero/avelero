/**
 * No-attribute variant table for explicit passport variants.
 */
"use client";

import type { ExplicitVariant } from "@/components/forms/passport/blocks/variant-block";
import { getNoAttributeVariantLabel } from "@/lib/variant-utils";
import { Input } from "@v1/ui/input";
import type * as React from "react";

interface NoAttributesTableProps {
  productName?: string;
  explicitVariants: ExplicitVariant[];
  setExplicitVariants: React.Dispatch<React.SetStateAction<ExplicitVariant[]>>;
}

/**
 * Table for explicit variants (imported without attributes).
 * Case 0: When there are explicit variants but no dimensions.
 */
export function NoAttributesTable({
  productName,
  explicitVariants,
  setExplicitVariants,
}: NoAttributesTableProps) {
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
        const isLastRow = idx === explicitVariants.length - 1;

        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Index is intentional - using editable fields (sku/barcode) causes focus loss when transitioning from empty to non-empty
            key={`variant-${idx}`}
            className={`grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] h-10 border-b border-border ${isLastRow ? "border-b-0" : ""}`}
          >
            <div className="px-4 flex items-center type-p text-primary">
              {getNoAttributeVariantLabel({
                index: idx,
                total: explicitVariants.length,
                productName,
              })}
            </div>
            <div
              className="border-l border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                value={variant.sku}
                onChange={(e) => {
                  setExplicitVariants((prev) => {
                    const next = [...prev];
                    next[idx] = {
                      ...next[idx],
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
                  setExplicitVariants((prev) => {
                    const next = [...prev];
                    next[idx] = {
                      ...next[idx],
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
