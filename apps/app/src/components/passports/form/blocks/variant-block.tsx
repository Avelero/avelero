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
import { usePassportFormData } from "@/hooks/use-passport-form-data";
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

interface VariantSectionProps {
  colorIds: string[];
  setColorIds: (value: string[]) => void;
  selectedSizes: TierTwoSizeOption[];
  setSelectedSizes: React.Dispatch<
    React.SetStateAction<TierTwoSizeOption[]>
  >;
}

const getSizeOptionKey = (
  option: Pick<TierTwoSizeOption, "categoryKey" | "name">,
) => `${option.categoryKey}::${(option.name || '').toLowerCase()}`;

export function VariantSection({
  colorIds,
  setColorIds,
  selectedSizes,
  setSelectedSizes,
}: VariantSectionProps) {
  const { colors: availableColors, sizeOptions } = usePassportFormData();
  const [customSizeOptions, setCustomSizeOptions] = React.useState<
    TierTwoSizeOption[]
  >([]);
  const [sizeModalOpen, setSizeModalOpen] = React.useState(false);
  const [prefillSize, setPrefillSize] = React.useState<string | null>(null);
  const [prefillCategory, setPrefillCategory] = React.useState<string | null>(null);

  // Convert colorIds to ColorOption objects for ColorSelect
  const selectedColors: ColorOption[] = React.useMemo(() => {
    return colorIds
      .map(id => {
        const color = availableColors.find(c => c.id === id);
        return color ? { name: color.name, hex: color.hex } : null;
      })
      .filter((c): c is ColorOption => c !== null);
  }, [colorIds, availableColors]);

  const combinedSizeOptions = React.useMemo(() => {
    if (customSizeOptions.length === 0) {
      return sizeOptions;
    }
    const map = new Map<string, TierTwoSizeOption>();
    // Only include options with valid names
    for (const option of sizeOptions) {
      if (option.name && typeof option.name === 'string') {
        map.set(getSizeOptionKey(option), option);
      }
    }
    for (const option of customSizeOptions) {
      if (option.name && typeof option.name === 'string') {
        map.set(getSizeOptionKey(option), option);
      }
    }
    return Array.from(map.values());
  }, [customSizeOptions, sizeOptions]);

  const normalizedSelectedSizes = React.useMemo(() => {
    if (combinedSizeOptions.length === 0) {
      return selectedSizes.filter(s => s.name && typeof s.name === 'string');
    }
    const optionMap = new Map<string, TierTwoSizeOption>();
    for (const option of combinedSizeOptions) {
      optionMap.set(getSizeOptionKey(option), option);
    }
    return selectedSizes
      .filter(s => s.name && typeof s.name === 'string')
      .map((size) => {
        const key = getSizeOptionKey(size);
        return optionMap.get(key) ?? size;
      });
  }, [combinedSizeOptions, selectedSizes]);

  React.useEffect(() => {
    if (!sizeModalOpen) {
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
    (definition: SizeSystemDefinition) => {
      // Filter out any sizes with invalid names
      const validSizes = definition.sizes.filter(
        (size) => size.name && typeof size.name === 'string' && size.name.trim() !== ''
      );

      const nextOptions = validSizes.map((size) => ({
        id: undefined,
        name: size.name,
        categoryKey: definition.categoryKey,
        categoryPath: definition.categoryPath,
        sortIndex: size.sortIndex,
        source: "custom" as const,
      }));

      setCustomSizeOptions((current: TierTwoSizeOption[]) => {
        const filtered = current.filter(
          (option) => option.categoryKey !== definition.categoryKey,
        );
        return [...filtered, ...nextOptions];
      });

      if (prefillSize) {
        const matchLower = prefillSize.toLowerCase();
        const match = nextOptions.find(
          (option) => option.name && option.name.toLowerCase() === matchLower,
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
        }
      }

      setPrefillSize(null);
      setPrefillCategory(null);
    },
    [prefillSize, setSelectedSizes],
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
                // Convert ColorOption[] to colorIds[]
                const newColorIds = newColors
                  .map(color => {
                    const found = availableColors.find(c => c.name === color.name);
                    return found?.id;
                  })
                  .filter((id): id is string => !!id);
                setColorIds(newColorIds);
              }}
              placeholder="Add color"
            />
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

