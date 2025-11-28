"use client";

import { cn } from "@v1/ui/cn";
import { FontFamilySelect } from "./font-family-select";
import { NumberField } from "./number-field";
import {
  SelectField,
  FONT_WEIGHT_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
} from "./select-field";
import type { TypographyScale } from "@v1/dpp-components";

interface TypographyScaleEditorProps {
  value: TypographyScale;
  onChange: (value: TypographyScale) => void;
  className?: string;
}

export function TypographyScaleEditor({
  value,
  onChange,
  className,
}: TypographyScaleEditorProps) {
  const handleChange = <K extends keyof TypographyScale>(
    key: K,
    newValue: TypographyScale[K]
  ) => {
    onChange({ ...value, [key]: newValue });
  };

  // Parse font size - could be string like "1.5rem" or number
  const fontSizeValue =
    typeof value.fontSize === "number"
      ? value.fontSize
      : Number.parseFloat(String(value.fontSize)) || 0;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Font Family */}
      <div className="flex flex-col gap-1.5">
        <span className="type-small text-secondary">Font</span>
        <FontFamilySelect
          value={value.fontFamily || ""}
          onChange={(v) => handleChange("fontFamily", v)}
        />
      </div>

      {/* Size and Weight row */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Size"
          value={fontSizeValue}
          onChange={(v) => handleChange("fontSize", v)}
          min={0}
          step={1}
          placeholder="px"
        />
        <SelectField
          label="Weight"
          value={String(value.fontWeight || "400")}
          onChange={(v) => handleChange("fontWeight", Number.parseInt(v, 10))}
          options={FONT_WEIGHT_OPTIONS}
        />
      </div>

      {/* Line height and Tracking row */}
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Line height"
          value={String(value.lineHeight || "1.25")}
          onChange={(v) => handleChange("lineHeight", Number.parseFloat(v))}
          options={LINE_HEIGHT_OPTIONS}
        />
        <SelectField
          label="Tracking"
          value={String(value.letterSpacing || "0em")}
          onChange={(v) => handleChange("letterSpacing", v)}
          options={LETTER_SPACING_OPTIONS}
        />
      </div>
    </div>
  );
}

