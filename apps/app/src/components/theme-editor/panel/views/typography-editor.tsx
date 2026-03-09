"use client";

/**
 * Typography editor for type scale, font family, and font-specific weight controls.
 */
import { saveThemeAction } from "@/actions/design/save-theme-action";
import { CustomFontsModal } from "@/components/modals/custom-fonts-modal";
import { FontSelect } from "@/components/select/font-select";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import type { CustomFont, TypographyScale } from "@v1/dpp-components";
import { toast } from "@v1/ui/sonner";
import { fonts } from "@v1/selections/fonts";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@v1/ui/select";
import * as React from "react";
import { FieldWrapper, PixelInput } from "../inputs";

// Typography scale configuration
const TYPOGRAPHY_SCALES = [
  { key: "h1" as const, label: "Heading 1" },
  { key: "h2" as const, label: "Heading 2" },
  { key: "h3" as const, label: "Heading 3" },
  { key: "h4" as const, label: "Heading 4" },
  { key: "h5" as const, label: "Heading 5" },
  { key: "h6" as const, label: "Heading 6" },
  { key: "body" as const, label: "Body" },
  { key: "body-sm" as const, label: "Small" },
  { key: "body-xs" as const, label: "Extra Small" },
] as const;

type TypographyScaleKey = (typeof TYPOGRAPHY_SCALES)[number]["key"];

// Select options for typography fields
const FONT_WEIGHT_OPTIONS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

const PRESET_WEIGHT_LABEL_BY_VALUE = new Map(
  FONT_WEIGHT_OPTIONS.map((option) => [
    Number.parseInt(option.value, 10),
    option.label,
  ]),
);
const FONT_WEIGHT_VALUES = FONT_WEIGHT_OPTIONS.map((option) =>
  Number.parseInt(option.value, 10),
);
const GOOGLE_FONT_BY_FAMILY = new Map(
  fonts.map((font) => [font.family.toLowerCase(), font]),
);

const LINE_HEIGHT_OPTIONS = [
  { value: "1", label: "Tight" },
  { value: "1.25", label: "Normal" },
  { value: "1.5", label: "Relaxed" },
  { value: "2", label: "Double" },
];

// letterSpacing is now a number in px
const LETTER_SPACING_OPTIONS = [
  { value: "-0.4", label: "Tight" },
  { value: "0", label: "Normal" },
  { value: "0.4", label: "Wide" },
];

function parseVariantWeight(variant: string): number | undefined {
  const normalizedVariant = variant.toLowerCase();
  if (normalizedVariant === "regular" || normalizedVariant === "italic") {
    return 400;
  }

  const match = normalizedVariant.match(/\d{3}/);
  if (!match?.[0]) return undefined;

  const parsedWeight = Number.parseInt(match[0], 10);
  return Number.isNaN(parsedWeight) ? undefined : parsedWeight;
}

function getWeightBucketLabel(weight: number): string {
  if (weight < 200) return "Thin";
  if (weight < 300) return "Extra Light";
  if (weight < 400) return "Light";
  if (weight < 500) return "Regular";
  if (weight < 600) return "Medium";
  if (weight < 700) return "Semi Bold";
  if (weight < 800) return "Bold";
  if (weight < 900) return "Extra Bold";
  return "Black";
}

function toWeightOption(weight: number): { value: string; label: string } {
  const presetLabel = PRESET_WEIGHT_LABEL_BY_VALUE.get(weight);
  if (presetLabel) {
    return { value: String(weight), label: presetLabel };
  }

  const bucketLabel = getWeightBucketLabel(weight);
  return { value: String(weight), label: `${bucketLabel} (${weight})` };
}

function getFallbackAxisWeight(start: number, end: number): number {
  const clampedWeight = Math.min(Math.max(400, start), end);
  return Math.round(clampedWeight);
}

function collectWeightsFromCustomFont(font: CustomFont): number[] {
  if (typeof font.fontWeight === "number") {
    return [font.fontWeight];
  }

  if (
    typeof font.fontWeight === "string" &&
    font.fontWeight.trim().includes(" ")
  ) {
    const [rawMin, rawMax] = font.fontWeight.trim().split(/\s+/);
    const minWeight = Number.parseInt(rawMin ?? "", 10);
    const maxWeight = Number.parseInt(rawMax ?? "", 10);

    if (!Number.isNaN(minWeight) && !Number.isNaN(maxWeight)) {
      return FONT_WEIGHT_VALUES.filter(
        (weight) => weight >= minWeight && weight <= maxWeight,
      );
    }
  }

  if (typeof font.fontWeight === "string") {
    const parsedWeight = Number.parseInt(font.fontWeight, 10);
    if (!Number.isNaN(parsedWeight)) {
      return [parsedWeight];
    }
  }

  return [400];
}

function getAvailableWeightOptions(
  fontFamily: string | undefined,
  customFonts: CustomFont[],
) {
  if (!fontFamily) return FONT_WEIGHT_OPTIONS;

  const normalizedFamily = fontFamily.toLowerCase();
  const customWeights = new Set<number>();

  for (const font of customFonts) {
    if (font.fontFamily.toLowerCase() === normalizedFamily) {
      for (const weight of collectWeightsFromCustomFont(font)) {
        customWeights.add(weight);
      }
    }
  }

  if (customWeights.size > 0) {
    return Array.from(customWeights)
      .sort((a, b) => a - b)
      .map(toWeightOption);
  }

  const googleFont = GOOGLE_FONT_BY_FAMILY.get(normalizedFamily);
  if (!googleFont) return FONT_WEIGHT_OPTIONS;

  const googleWeights = new Set<number>();

  if (googleFont.isVariable) {
    const weightAxis = googleFont.axes.find((axis) => axis.tag === "wght");
    if (!weightAxis) {
      return [toWeightOption(400)];
    }

    for (const weight of FONT_WEIGHT_VALUES) {
      if (weight >= weightAxis.start && weight <= weightAxis.end) {
        googleWeights.add(weight);
      }
    }

    if (googleWeights.size === 0) {
      googleWeights.add(
        getFallbackAxisWeight(weightAxis.start, weightAxis.end),
      );
    }
  } else if (googleFont.variants?.length) {
    for (const variant of googleFont.variants) {
      const variantWeight = parseVariantWeight(variant);
      if (variantWeight) {
        googleWeights.add(variantWeight);
      }
    }
  } else {
    googleWeights.add(400);
  }

  const sortedGoogleWeights = Array.from(googleWeights).sort((a, b) => a - b);
  return sortedGoogleWeights.length > 0
    ? sortedGoogleWeights.map(toWeightOption)
    : [toWeightOption(400)];
}

// ============================================================================
// Internal Select Component
// ============================================================================

interface TypographySelectProps {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function TypographySelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  className,
}: TypographySelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption?.label || placeholder;
  const isPlaceholder = !selectedOption;

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
  };

  return (
    <Select open={open} onOpenChange={setOpen}>
      <SelectTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={cn(
            "w-full justify-between data-[state=open]:bg-accent",
            className,
          )}
        >
          <span
            className={cn("truncate px-1", isPlaceholder && "text-tertiary")}
          >
            {displayValue}
          </span>
          <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
        </Button>
      </SelectTrigger>
      <SelectContent defaultValue={value}>
        <SelectList>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
              >
                <span className="type-p">{option.label}</span>
                {value === option.value && <Icons.Check className="h-4 w-4" />}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectList>
      </SelectContent>
    </Select>
  );
}

// Simple accordion item component
interface AccordionItemProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionItem({
  label,
  isOpen,
  onToggle,
  children,
}: AccordionItemProps) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
      >
        <span className="type-p text-foreground">{label}</span>
        <Icons.ChevronDown
          className={cn(
            "h-4 w-4 text-secondary transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Typography scale form (inlined)
interface TypographyScaleFormProps {
  value: TypographyScale;
  onChange: (value: TypographyScale) => void;
  customFonts: CustomFont[];
  onManageCustomFonts: () => void;
}

function TypographyScaleForm({
  value,
  onChange,
  customFonts,
  onManageCustomFonts,
}: TypographyScaleFormProps) {
  const handleChange = <K extends keyof TypographyScale>(
    key: K,
    newValue: TypographyScale[K],
  ) => {
    onChange({ ...value, [key]: newValue });
  };

  const weightOptions = React.useMemo(
    () => getAvailableWeightOptions(value.fontFamily, customFonts),
    [value.fontFamily, customFonts],
  );

  React.useEffect(() => {
    const currentWeight = Number.parseInt(String(value.fontWeight ?? 400), 10);
    const hasCurrentWeight = weightOptions.some(
      (option) => Number.parseInt(option.value, 10) === currentWeight,
    );

    if (!hasCurrentWeight) {
      const fallbackWeight = Number.parseInt(
        weightOptions[0]?.value ?? "400",
        10,
      );
      onChange({ ...value, fontWeight: fallbackWeight });
    }
  }, [weightOptions, value, onChange]);

  const fontSizeValue =
    typeof value.fontSize === "number"
      ? value.fontSize
      : Number.parseFloat(String(value.fontSize)) || 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Font Family */}
      <FieldWrapper label="Font">
        <FontSelect
          value={value.fontFamily || null}
          onValueChange={(v) => handleChange("fontFamily", v)}
          placeholder="Select font..."
          className="h-8 text-sm"
          customFonts={customFonts}
          onManageCustomFonts={onManageCustomFonts}
        />
      </FieldWrapper>

      {/* Size and Weight row */}
      <div className="grid grid-cols-2 gap-3">
        <PixelInput
          label="Size"
          value={fontSizeValue}
          onChange={(v) => handleChange("fontSize", v)}
          min={0}
          step={1}
          placeholder="px"
        />
        <FieldWrapper label="Weight">
          <TypographySelect
            value={String(value.fontWeight || "400")}
            onValueChange={(v) =>
              handleChange("fontWeight", Number.parseInt(v, 10))
            }
            options={weightOptions}
            placeholder="Select weight..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      </div>

      {/* Line height and Tracking row */}
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper label="Line height">
          <TypographySelect
            value={String(value.lineHeight || "1.25")}
            onValueChange={(v) =>
              handleChange("lineHeight", Number.parseFloat(v))
            }
            options={LINE_HEIGHT_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
        <FieldWrapper label="Tracking">
          <TypographySelect
            value={String(value.letterSpacing ?? 0)}
            onValueChange={(v) =>
              handleChange("letterSpacing", Number.parseFloat(v))
            }
            options={LETTER_SPACING_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      </div>
    </div>
  );
}

export function TypographyEditor() {
  const { passportDraft, updateCustomFonts, updateTypographyScale, brandId } =
    useDesignEditor();
  const [openItem, setOpenItem] = React.useState<string | null>(null);
  const [customFontsModalOpen, setCustomFontsModalOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const toggleItem = (key: string) => {
    setOpenItem((prev) => (prev === key ? null : key));
  };

  const getTypographyValue = (scale: TypographyScaleKey): TypographyScale => {
    return passportDraft.tokens.typography?.[scale] || ({} as TypographyScale);
  };

  // Get custom fonts from passport tokens
  const customFonts = passportDraft.tokens.fonts ?? [];

  // Update custom fonts and auto-save to database
  const handleCustomFontsChange = React.useCallback(
    async (fonts: CustomFont[]) => {
      // Update local state immediately for UI
      updateCustomFonts(fonts);

      // Auto-save to database so fonts persist without clicking Save
      if (brandId) {
        try {
          const updatedPassport = {
            ...passportDraft,
            tokens: {
              ...passportDraft.tokens,
              fonts,
            },
          };
          const result = await saveThemeAction({
            brandId,
            passport: updatedPassport,
          });
          if (result?.serverError) {
            throw new Error(result.serverError);
          }
          // Invalidate cache so re-entering the editor shows the fonts
          await queryClient.invalidateQueries({
            queryKey: trpc.brand.theme.get.queryKey(),
          });
        } catch {
          toast.error("Failed to save custom fonts");
        }
      }
    },
    [passportDraft, updateCustomFonts, brandId, queryClient, trpc],
  );

  const handleManageCustomFonts = React.useCallback(() => {
    setCustomFontsModalOpen(true);
  }, []);

  return (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {TYPOGRAPHY_SCALES.map(({ key, label }) => (
          <AccordionItem
            key={key}
            label={label}
            isOpen={openItem === key}
            onToggle={() => toggleItem(key)}
          >
            <TypographyScaleForm
              value={getTypographyValue(key)}
              onChange={(value) => updateTypographyScale(key, value)}
              customFonts={customFonts}
              onManageCustomFonts={handleManageCustomFonts}
            />
          </AccordionItem>
        ))}
      </div>

      {/* Custom Fonts Modal */}
      {brandId && (
        <CustomFontsModal
          open={customFontsModalOpen}
          onOpenChange={setCustomFontsModalOpen}
          brandId={brandId}
          customFonts={customFonts}
          onFontsChange={handleCustomFontsChange}
        />
      )}
    </>
  );
}
