"use client";

/**
 * Shared typography controls and option helpers for the theme editor.
 */

import type { CustomFont } from "@v1/dpp-components";
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

export interface TypographyOption {
  value: string;
  label: string;
}

export const FONT_WEIGHT_OPTIONS: TypographyOption[] = [
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

export const LINE_HEIGHT_OPTIONS: TypographyOption[] = [
  { value: "1", label: "1" },
  { value: "1.25", label: "1.25" },
  { value: "1.3", label: "1.3" },
  { value: "1.4", label: "1.4" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "2" },
];

export const TRACKING_OPTIONS: TypographyOption[] = [
  { value: "-0.4", label: "-0.4 px" },
  { value: "0", label: "0 px" },
  { value: "0.4", label: "0.4 px" },
];

export const CAPITALIZATION_OPTIONS: TypographyOption[] = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "capitalize", label: "Capitalize" },
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

interface ThemeTypographySelectProps {
  options: TypographyOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Render the shared compact select used across typography editors.
 */
export function ThemeTypographySelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  className,
}: ThemeTypographySelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);
  const displayValue = selectedOption?.label || placeholder;
  const isPlaceholder = !selectedOption;

  /**
   * Commit the selected value and close the popover.
   */
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
      <SelectContent defaultValue={value ?? undefined}>
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

/**
 * Parse a Google Font variant string into a numeric weight when possible.
 */
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

/**
 * Map arbitrary weights to the closest human-readable label.
 */
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

/**
 * Convert a numeric font weight into a select option label.
 */
function toWeightOption(weight: number): TypographyOption {
  const presetLabel = PRESET_WEIGHT_LABEL_BY_VALUE.get(weight);
  if (presetLabel) {
    return { value: String(weight), label: presetLabel };
  }

  return {
    value: String(weight),
    label: `${getWeightBucketLabel(weight)} (${weight})`,
  };
}

/**
 * Clamp a variable font axis to a safe default weight.
 */
function getFallbackAxisWeight(start: number, end: number): number {
  const clampedWeight = Math.min(Math.max(400, start), end);
  return Math.round(clampedWeight);
}

/**
 * Expand a stored custom font descriptor into the weight values it supports.
 */
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

/**
 * Resolve the safest weight options for the provided font family.
 */
export function getAvailableWeightOptions(
  fontFamily: string | undefined,
  customFonts: CustomFont[],
): TypographyOption[] {
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

  return Array.from(googleWeights)
    .sort((a, b) => a - b)
    .map(toWeightOption);
}
