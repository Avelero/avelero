"use client";

import { CustomSizeModal } from "@/components/modals/custom-size-modal";
import {
  type ColorOption,
  ColorSelect,
} from "@/components/select/color-select";
import { SizeSelect, type SizeOption } from "@/components/select/size-select";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { Label } from "@v1/ui/label";
import * as React from "react";

type PendingColorSelection = { name: string; hex: string };

interface VariantSectionProps {
  colorIds: string[];
  pendingColors: PendingColorSelection[];
  setColorIds: (value: string[]) => void;
  setPendingColors: (value: PendingColorSelection[]) => void;
  selectedSizes: SizeOption[];
  setSelectedSizes: React.Dispatch<React.SetStateAction<SizeOption[]>>;
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
  colorsError,
  sizesError,
}: VariantSectionProps) {
  const { colors: availableColors, sizeOptions } = useBrandCatalog();

  // Custom size modal state
  const [customSizeModalOpen, setCustomSizeModalOpen] = React.useState(false);
  const [pendingCustomSizeName, setPendingCustomSizeName] = React.useState("");

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

  // Normalize selected sizes to use real IDs from sizeOptions when available
  const normalizedSelectedSizes = React.useMemo(() => {
    if (sizeOptions.length === 0) {
      return selectedSizes.filter((s) => s.name && typeof s.name === "string");
    }

    const optionMap = new Map<string, SizeOption>();
    for (const option of sizeOptions) {
      if (option.name && typeof option.name === "string") {
        optionMap.set(option.name.toLowerCase(), option);
      }
    }

    return selectedSizes
      .filter((s) => s.name && typeof s.name === "string")
      .map((size) => {
        const key = size.name.toLowerCase();
        const matchedOption = optionMap.get(key);
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
  const handleCustomSizeSave = (size: { id: string; name: string; sortIndex: number }) => {
    // Add to selection with the real ID from the API
    // Use sortIndex for comparison since same name can exist in different groups
    setSelectedSizes((current) => {
      if (current.length >= 12) return current;
      if (current.some((s) => s.sortIndex === size.sortIndex)) {
        return current;
      }
      return [...current, size];
    });
  };

  const handleSizeSelectionChange = React.useCallback(
    (next: SizeOption[]) => {
      setSelectedSizes(next);
    },
    [setSelectedSizes],
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
              onCreateNew={handleCreateNewSize}
              placeholder="Add size"
            />
            {sizesError && (
              <p className="type-small text-destructive">{sizesError}</p>
            )}
          </div>
        </div>
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
