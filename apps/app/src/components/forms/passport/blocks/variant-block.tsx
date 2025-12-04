"use client";

import type { SizeSystemDefinition } from "@/components/modals/size-modal";
import {
  type ColorOption,
  ColorSelect,
} from "@/components/select/color-select";
import {
  SizeSelect,
  type TierTwoSizeOption,
} from "@/components/select/size-select";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { Label } from "@v1/ui/label";
import dynamic from "next/dynamic";
import * as React from "react";

// Lazy-load SizeModal to avoid SSR issues with QueryClient
const SizeModal = dynamic(
  () =>
    import("@/components/modals/size-modal").then((mod) => ({
      default: mod.SizeModal,
    })),
  { ssr: false },
);

type PendingColorSelection = { name: string; hex: string };

interface VariantSectionProps {
  colorIds: string[];
  pendingColors: PendingColorSelection[];
  setColorIds: (value: string[]) => void;
  setPendingColors: (value: PendingColorSelection[]) => void;
  selectedSizes: TierTwoSizeOption[];
  setSelectedSizes: React.Dispatch<React.SetStateAction<TierTwoSizeOption[]>>;
  colorsError?: string;
  sizesError?: string;
}

const getSizeOptionKey = (
  option: Pick<TierTwoSizeOption, "categoryKey" | "name">,
) => `${option.categoryKey}::${(option.name || "").toLowerCase()}`;

export function VariantSection({
  colorIds,
  pendingColors,
  setColorIds,
  setPendingColors,
  selectedSizes,
  setSelectedSizes,
  colorsError,
  sizesError,
}: VariantSectionProps) {
  const { colors: availableColors, sizeOptions } = useBrandCatalog();
  const [sizeModalOpen, setSizeModalOpen] = React.useState(false);
  const [prefillSize, setPrefillSize] = React.useState<string | null>(null);
  const [prefillCategory, setPrefillCategory] = React.useState<string | null>(
    null,
  );

  // Convert colorIds + pending colors to ColorOption objects for ColorSelect
  const selectedColors = React.useMemo<ColorOption[]>(() => {
    const mapped: ColorOption[] = [];
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
    for (const pending of pendingColors) {
      mapped.push({
        name: pending.name,
        hex: pending.hex,
      });
    }
    return mapped;
  }, [colorIds, pendingColors, availableColors]);

  // Normalize selected sizes to use real IDs from sizeOptions
  // This ensures custom sizes created via SizeModal get their real DB IDs
  const normalizedSelectedSizes = React.useMemo(() => {
    if (sizeOptions.length === 0) {
      return selectedSizes.filter((s) => s.name && typeof s.name === "string");
    }
    const optionMap = new Map<string, TierTwoSizeOption>();
    for (const option of sizeOptions) {
      if (option.name && typeof option.name === "string" && option?.id) {
        optionMap.set(getSizeOptionKey(option), option);
      }
    }
    return selectedSizes
      .filter((s) => s.name && typeof s.name === "string")
      .map((size) => {
        const key = getSizeOptionKey(size);
        const matchedOption = optionMap.get(key);
        // Only return sizes with real IDs from the API
        if (matchedOption?.id) {
          return matchedOption;
        }
        // If no match found, return the size as-is (will be filtered out during submission)
        return size;
      })
      .filter((s) => s.id); // Filter out sizes without IDs
  }, [sizeOptions, selectedSizes]);

  // Watch for newly created sizes to appear in sizeOptions after modal saves
  React.useEffect(() => {
    if (!sizeModalOpen && prefillSize && prefillCategory) {
      // Modal just closed, look for the prefillSize in sizeOptions
      const matchLower = prefillSize.toLowerCase();
      const match = sizeOptions.find(
        (option) =>
          option.name &&
          option.name.toLowerCase() === matchLower &&
          option.categoryPath === prefillCategory &&
          option.id, // Only select if it has a real ID
      );
      if (match) {
        setSelectedSizes((current: TierTwoSizeOption[]) => {
          const exists = current.some(
            (option) => getSizeOptionKey(option) === getSizeOptionKey(match),
          );
          if (exists || current.length >= 12) {
            return current;
          }
          return [...current, match];
        });
        // Clear prefill after successful selection
        setPrefillSize(null);
        setPrefillCategory(null);
      }
    }
  }, [
    sizeModalOpen,
    prefillSize,
    prefillCategory,
    sizeOptions,
    setSelectedSizes,
  ]);

  React.useEffect(() => {
    if (!sizeModalOpen) {
      // Clear prefill when modal closes (if not already cleared by selection)
      setPrefillSize(null);
      setPrefillCategory(null);
    }
  }, [sizeModalOpen]);

  const handleSizeSelectionChange = React.useCallback(
    (next: TierTwoSizeOption[]) => {
      setSelectedSizes(next);
    },
    [setSelectedSizes],
  );

  const handleSizeSystemSave = React.useCallback(
    (_definition: SizeSystemDefinition) => {
      // SizeModal already creates sizes in DB and invalidates queries
      // The useEffect above will watch for the new sizes to appear in sizeOptions
      // and automatically select the prefillSize when it becomes available
      // No need to do anything here - just let the refetch happen
    },
    [],
  );

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
                  if (color.id) {
                    nextIds.add(color.id);
                  } else {
                    const key = color.name.trim().toLowerCase();
                    if (!key) return;
                    pendingMap.set(key, {
                      name: color.name.trim(),
                      hex: color.hex.replace("#", "").trim().toUpperCase(),
                    });
                  }
                }

                setColorIds(Array.from(nextIds));
                setPendingColors(Array.from(pendingMap.values()));
              }}
              placeholder="Add color"
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
              onCreateNew={(initial, categoryPath) => {
                setPrefillSize(initial);
                setPrefillCategory(categoryPath || null);
                setSizeModalOpen(true);
              }}
              placeholder="Add size"
            />
            {sizesError && (
              <p className="type-small text-destructive">{sizesError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <SizeModal
        open={sizeModalOpen}
        onOpenChange={setSizeModalOpen}
        prefillSize={prefillSize}
        prefillCategory={prefillCategory}
        onSave={handleSizeSystemSave}
      />
    </>
  );
}
