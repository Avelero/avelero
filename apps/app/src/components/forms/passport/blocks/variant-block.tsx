"use client";

import { CustomSizeModal } from "@/components/modals/custom-size-modal";
import {
  type ColorOption,
  ColorSelect,
} from "@/components/select/color-select";
import { SizeSelect, type SizeOption } from "@/components/select/size-select";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import type { VariantData } from "@/hooks/use-passport-form";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import * as React from "react";

type PendingColorSelection = { name: string; hex: string };

const PENDING_COLOR_PREFIX = "pending-color:";
const PENDING_SIZE_PREFIX = "pending-size:";

const normalizeKeyPart = (value: string) => value.trim().toLowerCase();

const pendingColorKey = (name: string) =>
  `${PENDING_COLOR_PREFIX}${normalizeKeyPart(name)}`;

const pendingSizeKey = (name: string) =>
  `${PENDING_SIZE_PREFIX}${normalizeKeyPart(name)}`;

const toColorKey = (color: { id?: string; name: string }) =>
  color.id && color.id.length > 0 ? color.id : pendingColorKey(color.name);

const toSizeKey = (size: { id?: string; name: string }) =>
  size.id && size.id.length > 0 ? size.id : pendingSizeKey(size.name);

interface VariantSectionProps {
  colorIds: string[];
  pendingColors: PendingColorSelection[];
  setColorIds: (value: string[]) => void;
  setPendingColors: (value: PendingColorSelection[]) => void;
  selectedSizes: SizeOption[];
  setSelectedSizes: React.Dispatch<React.SetStateAction<SizeOption[]>>;
  variantData: VariantData[];
  updateVariantData: (updater: (prev: VariantData[]) => VariantData[]) => void;
  colorsError?: string;
  sizesError?: string;
}

export function VariantSection({
  colorIds,
  pendingColors,
  setColorIds,
  setPendingColors,
  selectedSizes,
  setSelectedSizes,
  variantData,
  updateVariantData,
  colorsError,
  sizesError,
}: VariantSectionProps) {
  const { colors: availableColors, sizeOptions } = useBrandCatalog();

  // Custom size modal state
  const [customSizeModalOpen, setCustomSizeModalOpen] = React.useState(false);
  const [pendingCustomSizeName, setPendingCustomSizeName] = React.useState("");

  // Accordion state - track which color groups are expanded
  const [expandedColors, setExpandedColors] = React.useState<Set<string>>(
    new Set(),
  );

  /**
   * Convert colorIds + pending colors to ColorOption objects for ColorSelect.
   *
   * - colorIds: UUIDs of colors already in brand's database
   * - pendingColors: Colors selected but not yet in database (default colors or pending creation)
   */
  const selectedColors = React.useMemo<ColorOption[]>(() => {
    const mapped: ColorOption[] = [];

    // Map existing brand colors (have real UUIDs)
    for (const id of colorIds) {
      const color = availableColors.find((c) => c.id === id);
      if (color) {
        mapped.push({
          id: color.id ?? undefined,
          name: color.name,
          hex: color.hex,
        });
      }
    }

    // Map pending colors (default colors or manually created colors waiting for product save)
    // These have no id - they'll be created when the product is saved
    for (const pending of pendingColors) {
      mapped.push({
        id: undefined, // Explicitly undefined - will be created on product save
        name: pending.name,
        hex: pending.hex,
      });
    }

    return mapped;
  }, [colorIds, pendingColors, availableColors]);

  // Normalize selected sizes to use real IDs from sizeOptions when available
  const normalizedSelectedSizes = React.useMemo(() => {
    if (sizeOptions.length === 0) {
      return selectedSizes.filter((s) => s.name && typeof s.name === "string");
    }

    // Match by name (case-insensitive) - brand sizes replace defaults with same name
    const optionMap = new Map<string, SizeOption>();
    for (const option of sizeOptions) {
      optionMap.set(option.name.toLowerCase(), option);
    }

    return selectedSizes
      .filter((s) => s.name && typeof s.name === "string")
      .map((size) => {
        const matchedOption = optionMap.get(size.name.toLowerCase());
        // If we find a match with a real ID, use it
        if (matchedOption?.id) {
          return matchedOption;
        }
        // Otherwise return the size as-is (custom size without ID yet)
        return size;
      });
  }, [sizeOptions, selectedSizes]);

  // Handle "Create new" from SizeSelect
  const handleCreateNewSize = (sizeName: string) => {
    setPendingCustomSizeName(sizeName);
    setCustomSizeModalOpen(true);
  };

  // Handle save from CustomSizeModal (size is already persisted with an ID)
  const handleCustomSizeSave = (size: { id: string; name: string }) => {
    // Add to selection with the real ID from the API
    // Match by name (case-insensitive)
    setSelectedSizes((current) => {
      if (current.length >= 12) return current;
      if (current.some((s) => s.name.toLowerCase() === size.name.toLowerCase())) {
        return current;
      }
      return [...current, { id: size.id, name: size.name, displayHint: 1000, isDefault: false }];
    });
  };

  const handleSizeSelectionChange = React.useCallback(
    (next: SizeOption[]) => {
      setSelectedSizes(next);
    },
    [setSelectedSizes],
  );

  // Helper to create variant key for lookups
  const getVariantKey = React.useCallback(
    (colorId: string | null, sizeId: string | null) => {
      return `${colorId ?? "null"}:${sizeId ?? "null"}`;
    },
    [],
  );

  // Helper to get variant SKU/barcode from variantData
  const getVariantField = React.useCallback(
    (colorId: string | null, sizeId: string | null, field: "sku" | "barcode") => {
      const key = getVariantKey(colorId, sizeId);
      const variant = variantData.find(
        (v) => getVariantKey(v.colorId, v.sizeId) === key,
      );
      return variant?.[field] ?? "";
    },
    [variantData, getVariantKey],
  );

  // Helper to update variant field
  const updateVariantField = React.useCallback(
    (
      colorId: string | null,
      sizeId: string | null,
      field: "sku" | "barcode",
      value: string,
    ) => {
      const key = getVariantKey(colorId, sizeId);
      updateVariantData((prev) => {
        const existingIndex = prev.findIndex(
          (v) => getVariantKey(v.colorId, v.sizeId) === key,
        );

        if (existingIndex >= 0) {
          // Update existing variant
          const updated = [...prev];
          const existing = updated[existingIndex];
          if (existing) {
            updated[existingIndex] = {
              colorId: existing.colorId,
              sizeId: existing.sizeId,
              sku: field === "sku" ? value : existing.sku,
              barcode: field === "barcode" ? value : existing.barcode,
            };
          }
          return updated;
        }
        // Create new variant entry
        return [
          ...prev,
          {
            colorId: colorId ?? null,
            sizeId: sizeId ?? null,
            sku: field === "sku" ? value : "",
            barcode: field === "barcode" ? value : "",
          },
        ];
      });
    },
    [getVariantKey, updateVariantData],
  );

  // Helper to update variant field by index (for Case 0 variants with no color/size)
  const updateVariantFieldByIndex = React.useCallback(
    (index: number, field: "sku" | "barcode", value: string) => {
      updateVariantData((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const updated = [...prev];
        const existing = updated[index];
        if (existing) {
          updated[index] = {
            colorId: existing.colorId,
            sizeId: existing.sizeId,
            sku: field === "sku" ? value : existing.sku,
            barcode: field === "barcode" ? value : existing.barcode,
          };
        }
        return updated;
      });
    },
    [updateVariantData],
  );

  // Variant type for consistent typing
  type VariantItem = {
    key: string;
    sizeId: string | null;
    sizeName: string | null;
    sku: string;
    barcode: string;
    /** Index in variantData array (for Case 0 variants only) */
    variantDataIndex?: number;
  };

  type VariantGroup = {
    colorId: string | null;
    colorName: string | null;
    hex: string | null;
    variants: VariantItem[];
  };

  // Generate variant groups structure for accordion display
  const variantGroups = React.useMemo((): VariantGroup[] => {
    const colors = selectedColors;
    const sizes = normalizedSelectedSizes;

    // Case 0: Neither colors nor sizes selected, but we have variant data
    // This can happen when a product was imported from Shopify with color/size fields disabled.
    // Show variants identified by SKU, barcode, or index.
    if (colors.length === 0 && sizes.length === 0) {
      // Check if we have any variant data to display
      if (variantData.length === 0) {
        return [];
      }
      
      // Show all variants from variantData as a flat list
      return [
        {
          colorId: null,
          colorName: null,
          hex: null,
          variants: variantData.map((v, idx) => {
            // Generate a unique key for each variant based on index
            // (since colorId/sizeId are both null and can't distinguish)
            const variantKey = `variant-${idx}`;
            return {
              key: variantKey,
              sizeId: null,
              // Use SKU as display name, fall back to barcode, then index
              sizeName: v.sku || v.barcode || `Variant ${idx + 1}`,
              sku: v.sku,
              barcode: v.barcode,
              variantDataIndex: idx,  // Store index for updates
            };
          }),
        },
      ];
    }

    // Case 1: Only sizes, no colors
    if (colors.length === 0) {
      return [
        {
          colorId: null,
          colorName: null,
          hex: null,
          variants: sizes.map((size) => {
            const sizeKey = toSizeKey(size);
            return {
              key: getVariantKey(null, sizeKey),
              sizeId: sizeKey,
              sizeName: size.name,
              sku: getVariantField(null, sizeKey, "sku"),
              barcode: getVariantField(null, sizeKey, "barcode"),
            };
          }),
        },
      ];
    }

    // Case 2: Only colors, no sizes
    if (sizes.length === 0) {
      return colors.map((color) => {
        const colorKey = toColorKey(color);
        return {
          colorId: colorKey,
          colorName: color.name,
          hex: color.hex ?? null,
          variants: [
            {
              key: getVariantKey(colorKey, null),
              sizeId: null,
              sizeName: null,
              sku: getVariantField(colorKey, null, "sku"),
              barcode: getVariantField(colorKey, null, "barcode"),
            },
          ],
        };
      });
    }

    // Case 3: Both colors and sizes
    return colors.map((color) => {
      const colorKey = toColorKey(color);
      return {
        colorId: colorKey,
        colorName: color.name,
        hex: color.hex ?? null,
        variants: sizes.map((size) => {
          const sizeKey = toSizeKey(size);
          return {
            key: getVariantKey(colorKey, sizeKey),
            sizeId: sizeKey,
            sizeName: size.name,
            sku: getVariantField(colorKey, sizeKey, "sku"),
            barcode: getVariantField(colorKey, sizeKey, "barcode"),
          };
        }),
      };
    });
  }, [
    selectedColors,
    normalizedSelectedSizes,
    getVariantKey,
    getVariantField,
  ]);

  // Toggle color expansion
  const toggleColorExpansion = React.useCallback(
    (colorId: string | null) => {
      const key = colorId ?? "null";
      setExpandedColors((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [],
  );

  const hasVariants = variantGroups.length > 0;
  // Check if we have both dimensions (colors AND sizes) - only then show accordion
  const hasBothDimensions = selectedColors.length > 0 && normalizedSelectedSizes.length > 0;

  return (
    <>
      <div className="border border-border bg-background">
        <div className="p-4 flex flex-col gap-3">
          <p className="type-p !font-medium text-primary">Variant</p>

          {/* Color Field */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorSelect
              value={selectedColors}
              onValueChange={(newColors) => {
                if (newColors.length > 12) {
                  return;
                }
                const nextIds = new Set<string>();
                const pendingMap = new Map<string, PendingColorSelection>();

                for (const color of newColors) {
                  // Colors with id are already in the brand's database
                  // Colors without id are:
                  //   - Default colors (selected but not yet created)
                  //   - Custom colors that will be created on product save
                  if (color.id && color.id.length > 0) {
                    nextIds.add(color.id);
                  } else {
                    // No id = pending color (will be created when product is saved)
                    const key = color.name.trim().toLowerCase();
                    if (!key) continue; // Skip empty names, don't return
                    pendingMap.set(key, {
                      name: color.name.trim(),
                      hex: (color.hex ?? "").replace("#", "").trim().toUpperCase(),
                    });
                  }
                }

                setColorIds(Array.from(nextIds));
                setPendingColors(Array.from(pendingMap.values()));
              }}
              placeholder="Add colors"
            />
            {colorsError && (
              <p className="type-small text-destructive">{colorsError}</p>
            )}
          </div>

          {/* Size Field */}
          <div className="space-y-1.5">
            <Label>Size</Label>
            <SizeSelect
              value={normalizedSelectedSizes}
              onValueChange={handleSizeSelectionChange}
              onCreateNew={handleCreateNewSize}
              placeholder="Add sizes"
            />
            {sizesError && (
              <p className="type-small text-destructive">{sizesError}</p>
            )}
          </div>
        </div>

        {/* Variant Section - Only show when variants exist */}
        {hasVariants && (
          <div className="border-t border-border">
            {/* Header Row */}
            <div className="grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] bg-accent-light border-b border-border">
              <div className="px-4 py-2 type-small text-secondary">Variant</div>
              <div className="px-4 py-2 type-small text-secondary">SKU</div>
              <div className="px-4 py-2 type-small text-secondary">Barcode</div>
            </div>

            {/* Single dimension: flat list with inline SKU/barcode */}
            {!hasBothDimensions && variantGroups.flatMap((group, groupIndex) => 
              group.variants.map((variant, variantIndex) => ({
                ...variant,
                colorId: group.colorId,
                colorName: group.colorName,
                colorHex: group.hex,
                uniqueKey: `${groupIndex}-${variantIndex}-${variant.key}`,
              }))
            ).map((variant, index, arr) => {
              const isLast = index === arr.length - 1;
              // For colors-only, show color name; for sizes-only or Case 0, show size name (which may be SKU/barcode/index)
              const displayName = variant.sizeName ?? variant.colorName ?? "Variant";
              // Check if this is a Case 0 variant (has variantDataIndex)
              const isCase0Variant = variant.variantDataIndex !== undefined;

              return (
                <div
                  key={variant.uniqueKey}
                  className={cn(
                    "grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] bg-background h-10",
                    !isLast && "border-b border-border",
                  )}
                >
                  <div className="px-4 py-2 flex items-center gap-2">
                    {variant.colorHex && (
                      <div
                        className="h-3 w-3 border rounded-full border-border flex-shrink-0"
                        style={{ backgroundColor: `#${variant.colorHex}` }}
                      />
                    )}
                    <span className="type-p text-primary truncate">
                      {displayName}
                    </span>
                  </div>
                  <div className="px-2 py-1.5 border-l border-border">
                    <Input
                      value={variant.sku}
                      onChange={(e) =>
                        isCase0Variant
                          ? updateVariantFieldByIndex(variant.variantDataIndex!, "sku", e.target.value)
                          : updateVariantField(variant.colorId, variant.sizeId, "sku", e.target.value)
                      }
                      placeholder="SKU"
                      className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                    />
                  </div>
                  <div className="px-2 py-1.5 border-l border-border">
                    <Input
                      value={variant.barcode}
                      onChange={(e) =>
                        isCase0Variant
                          ? updateVariantFieldByIndex(variant.variantDataIndex!, "barcode", e.target.value)
                          : updateVariantField(variant.colorId, variant.sizeId, "barcode", e.target.value)
                      }
                      placeholder="Barcode"
                      className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                    />
                  </div>
                </div>
              );
            })}

            {/* Both dimensions: accordion with expandable color groups */}
            {hasBothDimensions && variantGroups.map((group, groupIndex) => {
              const colorKey = group.colorId ?? `group-${groupIndex}`;
              const isExpanded = expandedColors.has(group.colorId ?? "null");
              const isLastGroup = groupIndex === variantGroups.length - 1;

              return (
                <div key={colorKey}>
                  {/* Parent Row (Color) - Clickable to expand/collapse */}
                  <button
                    type="button"
                    onClick={() => toggleColorExpansion(group.colorId)}
                    className={cn(
                      "w-full h-10 hover:bg-accent transition-colors text-left",
                      "px-4 py-2 flex items-center gap-2",
                      // Add border unless it's the last group AND collapsed (to avoid double border with container)
                      !(isLastGroup && !isExpanded) && "border-b border-border",
                    )}
                  >
                    {group.hex && (
                      <div
                        className="h-3 w-3 border rounded-full border-border flex-shrink-0"
                        style={{ backgroundColor: `#${group.hex}` }}
                      />
                    )}
                    <span className="type-p text-primary">
                      {group.colorName ?? "No color"}
                    </span>
                    <span className="type-small text-tertiary">
                      {group.variants.length} variant
                      {group.variants.length !== 1 ? "s" : ""}
                    </span>
                    <Icons.ChevronDown
                      className={cn(
                        "h-4 w-4 text-tertiary transition-transform flex-shrink-0",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  {/* Child Rows (Sizes) - Conditionally rendered */}
                  {isExpanded &&
                    group.variants.map((variant, variantIndex) => {
                      const isLastVariant = variantIndex === group.variants.length - 1;
                      const isLastRow = isLastGroup && isLastVariant;
                      return (
                        <div
                          key={`${colorKey}-${variant.sizeId ?? variantIndex}`}
                          className={cn(
                            "grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] bg-background",
                            !isLastRow && "border-b border-border",
                          )}
                        >
                          <div className="px-4 py-2 pl-10 flex items-center">
                            <span className="type-p text-primary truncate">
                              {variant.sizeName ?? "No size"}
                            </span>
                          </div>
                          <div className="px-2 py-1.5 border-l border-border">
                            <Input
                              value={variant.sku}
                              onChange={(e) =>
                                updateVariantField(
                                  group.colorId,
                                  variant.sizeId,
                                  "sku",
                                  e.target.value,
                                )
                              }
                              placeholder="SKU"
                              className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                            />
                          </div>
                          <div className="px-2 py-1.5 border-l border-border">
                            <Input
                              value={variant.barcode}
                              onChange={(e) =>
                                updateVariantField(
                                  group.colorId,
                                  variant.sizeId,
                                  "barcode",
                                  e.target.value,
                                )
                              }
                              placeholder="Barcode"
                              className="h-7 border-0 bg-transparent type-p px-2 focus-visible:ring-0"
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Size Modal */}
      <CustomSizeModal
        open={customSizeModalOpen}
        onOpenChange={setCustomSizeModalOpen}
        initialSizeName={pendingCustomSizeName}
        onSave={handleCustomSizeSave}
      />
    </>
  );
}
