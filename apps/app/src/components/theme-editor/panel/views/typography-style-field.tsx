"use client";

/**
 * Component-level typography field with attach/detach behavior.
 *
 * Keeps a remembered typescale token while allowing per-element overrides for
 * size, weight, line height, and letter spacing.
 */

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { fonts } from "@v1/selections/fonts";
import type { CustomFont, TypeScale } from "@v1/dpp-components";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@v1/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import * as React from "react";
import { type StyleField, TYPESCALE_OPTIONS } from "../../registry";
import { FieldWrapper, PixelInput } from "../inputs";

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

const LINE_HEIGHT_OPTIONS = [
  { value: "1", label: "100%" },
  { value: "1.25", label: "125%" },
  { value: "1.5", label: "150%" },
  { value: "2", label: "200%" },
];

const LETTER_SPACING_OPTIONS = [
  { value: "-0.4", label: "-0.4 px" },
  { value: "0", label: "0 px" },
  { value: "0.4", label: "0.4 px" },
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

interface TypographySelectProps {
  options: { value: string; label: string }[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Render a compact select used by the component-level typography editor. */
function TypographySelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  className,
}: TypographySelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);
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

/** Parse a Google font variant string into a numeric weight when possible. */
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

/** Map arbitrary weights to a readable bucket label for the select list. */
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

/** Convert a numeric weight into a labeled select option. */
function toWeightOption(weight: number): { value: string; label: string } {
  const presetLabel = PRESET_WEIGHT_LABEL_BY_VALUE.get(weight);
  if (presetLabel) {
    return { value: String(weight), label: presetLabel };
  }

  return {
    value: String(weight),
    label: `${getWeightBucketLabel(weight)} (${weight})`,
  };
}

/** Clamp a variable-font axis to a safe default weight. */
function getFallbackAxisWeight(start: number, end: number): number {
  const clampedWeight = Math.min(Math.max(400, start), end);
  return Math.round(clampedWeight);
}

/** Extract available weights from a stored custom font descriptor. */
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

/** Resolve the safest weight options for the currently attached font family. */
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

  return Array.from(googleWeights)
    .sort((a, b) => a - b)
    .map(toWeightOption);
}

/** Split a style field path into its style key and property name. */
function splitStyleFieldPath(
  path: string,
): { styleKey: string; property: string } | null {
  const separatorIndex = path.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= path.length - 1) {
    return null;
  }

  return {
    styleKey: path.slice(0, separatorIndex),
    property: path.slice(separatorIndex + 1),
  };
}

/** Build a small icon button with a tooltip for attach/detach actions. */
function TypographyModeButton({
  detached,
  onClick,
}: {
  detached: boolean;
  onClick: () => void;
}) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded"
            onClick={onClick}
            aria-label={detached ? "Attach typography token" : "Detach typography token"}
          >
            {detached ? (
              <Icons.Link className="h-4 w-4" />
            ) : (
              <Icons.Unlink className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {detached ? "Attach style" : "Detach style"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Render the attach/detach typography control for a single component field. */
export function TypographyStyleField({ field }: { field: StyleField }) {
  const { passportDraft, getRawComponentStyleValue, updateComponentStyle } =
    useDesignEditor();
  const pathParts = React.useMemo(
    () => splitStyleFieldPath(field.path),
    [field.path],
  );

  const rawTypescale = getRawComponentStyleValue(field.path);
  const typescale =
    typeof rawTypescale === "string" ? (rawTypescale as TypeScale) : null;
  const scaleConfig = typescale
    ? passportDraft.tokens.typography[typescale]
    : undefined;
  const customFonts = passportDraft.tokens.fonts ?? [];

  const isDetached =
    pathParts !== null &&
    getRawComponentStyleValue(`${pathParts.styleKey}.typographyDetached`) ===
      true;

  const fontSize =
    pathParts !== null &&
    typeof getRawComponentStyleValue(`${pathParts.styleKey}.fontSize`) ===
      "number"
      ? (getRawComponentStyleValue(
          `${pathParts.styleKey}.fontSize`,
        ) as number)
      : (scaleConfig?.fontSize ?? 0);

  const fontWeight =
    pathParts !== null &&
    typeof getRawComponentStyleValue(`${pathParts.styleKey}.fontWeight`) ===
      "number"
      ? (getRawComponentStyleValue(
          `${pathParts.styleKey}.fontWeight`,
        ) as number)
      : (scaleConfig?.fontWeight ?? 400);

  const lineHeight =
    pathParts !== null &&
    typeof getRawComponentStyleValue(`${pathParts.styleKey}.lineHeight`) ===
      "number"
      ? (getRawComponentStyleValue(
          `${pathParts.styleKey}.lineHeight`,
        ) as number)
      : (scaleConfig?.lineHeight ?? 1.25);

  const letterSpacing =
    pathParts !== null &&
    typeof getRawComponentStyleValue(`${pathParts.styleKey}.letterSpacing`) ===
      "number"
      ? (getRawComponentStyleValue(
          `${pathParts.styleKey}.letterSpacing`,
        ) as number)
      : (scaleConfig?.letterSpacing ?? 0);

  const weightOptions = React.useMemo(
    () => getAvailableWeightOptions(scaleConfig?.fontFamily, customFonts),
    [customFonts, scaleConfig?.fontFamily],
  );

  const handleDetach = () => {
    if (!pathParts || !scaleConfig) return;

    updateComponentStyle(`${pathParts.styleKey}.fontSize`, scaleConfig.fontSize);
    updateComponentStyle(
      `${pathParts.styleKey}.fontWeight`,
      scaleConfig.fontWeight,
    );
    updateComponentStyle(
      `${pathParts.styleKey}.lineHeight`,
      scaleConfig.lineHeight,
    );
    updateComponentStyle(
      `${pathParts.styleKey}.letterSpacing`,
      scaleConfig.letterSpacing,
    );
    updateComponentStyle(`${pathParts.styleKey}.typographyDetached`, true);
  };

  const handleAttach = () => {
    if (!pathParts) return;

    updateComponentStyle(`${pathParts.styleKey}.typographyDetached`, undefined);
    updateComponentStyle(`${pathParts.styleKey}.fontSize`, undefined);
    updateComponentStyle(`${pathParts.styleKey}.fontWeight`, undefined);
    updateComponentStyle(`${pathParts.styleKey}.lineHeight`, undefined);
    updateComponentStyle(`${pathParts.styleKey}.letterSpacing`, undefined);
  };

  const handleTypographyModeToggle = () => {
    if (isDetached) {
      handleAttach();
      return;
    }
    handleDetach();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label variant="small">{field.label}</Label>
          <TypographyModeButton
            detached={isDetached}
            onClick={handleTypographyModeToggle}
          />
        </div>

        {!isDetached ? (
          <TypographySelect
            value={typescale}
            onValueChange={(value) => updateComponentStyle(field.path, value)}
            options={TYPESCALE_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        ) : null}
      </div>

      {isDetached && (
        <div className="grid grid-cols-2 gap-3">
          <PixelInput
            label="Size"
            value={fontSize}
            onChange={(value) =>
              pathParts &&
              updateComponentStyle(`${pathParts.styleKey}.fontSize`, value)
            }
            min={0}
            step={1}
            placeholder="px"
          />

          <FieldWrapper label="Weight">
            <TypographySelect
              value={String(fontWeight)}
              onValueChange={(value) =>
                pathParts &&
                updateComponentStyle(
                  `${pathParts.styleKey}.fontWeight`,
                  Number.parseInt(value, 10),
                )
              }
              options={weightOptions}
              placeholder="Select..."
              className="h-8 text-sm"
            />
          </FieldWrapper>

          <FieldWrapper label="Line height">
            <TypographySelect
              value={String(lineHeight)}
              onValueChange={(value) =>
                pathParts &&
                updateComponentStyle(
                  `${pathParts.styleKey}.lineHeight`,
                  Number.parseFloat(value),
                )
              }
              options={LINE_HEIGHT_OPTIONS}
              placeholder="Select..."
              className="h-8 text-sm"
            />
          </FieldWrapper>

          <FieldWrapper label="Letter spacing">
            <TypographySelect
              value={String(letterSpacing)}
              onValueChange={(value) =>
                pathParts &&
                updateComponentStyle(
                  `${pathParts.styleKey}.letterSpacing`,
                  Number.parseFloat(value),
                )
              }
              options={LETTER_SPACING_OPTIONS}
              placeholder="Select..."
              className="h-8 text-sm"
            />
          </FieldWrapper>
        </div>
      )}
    </div>
  );
}
