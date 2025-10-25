"use client";

import * as React from "react";
import { cn } from "../utils";
import { Input } from "./input";

interface MinMaxInputProps {
  value: { min?: number; max?: number };
  onChange: (value: { min?: number; max?: number }) => void;
  unit?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Input component for entering a numeric minimum and maximum with validation and formatting.
 *
 * Accepts optional numeric `min`/`max` values and lets the user edit them as text; empty fields are allowed.
 * On blur, input text is parsed (commas accepted as decimal separators), negative values are clamped to 0,
 * and values are rounded to 4 decimal places before being propagated via `onChange`.
 *
 * @param value - Current value object with optional `min` and `max` numbers.
 * @param onChange - Callback invoked with `{ min, max }` where each is a parsed number or `undefined` for empty.
 * @param unit - Optional unit label displayed alongside the inputs.
 * @param disabled - If true, both inputs are disabled.
 * @param className - Optional additional container CSS classes.
 * @returns A JSX element containing the paired min/max text inputs and an optional unit display.
 */
export function MinMaxInput({
  value,
  onChange,
  unit,
  disabled = false,
  className,
}: MinMaxInputProps) {
  const [minText, setMinText] = React.useState(value?.min?.toString() ?? "");
  const [maxText, setMaxText] = React.useState(value?.max?.toString() ?? "");

  // Sync local state when value changes externally
  React.useEffect(() => {
    setMinText(value?.min?.toString() ?? "");
    setMaxText(value?.max?.toString() ?? "");
  }, [value?.min, value?.max]);

  // Helper to parse a text value
  const parseValue = (text: string): number | undefined => {
    const trimmed = text.trim();
    if (trimmed === "") return undefined;

    const normalized = trimmed.replace(/,/g, ".");
    let num = Number.parseFloat(normalized);
    if (Number.isNaN(num)) return undefined;

    // No negatives
    if (num < 0) num = 0;

    // Round to 4 decimals
    return Math.round(num * 10000) / 10000;
  };

  const handleMinChange = (input: string) => {
    // Only allow numbers, dots, and commas
    if (input !== "" && !/^[\d.,]*$/.test(input)) return;
    setMinText(input);
  };

  const handleMaxChange = (input: string) => {
    // Only allow numbers, dots, and commas
    if (input !== "" && !/^[\d.,]*$/.test(input)) return;
    setMaxText(input);
  };

  const handleMinBlur = () => {
    const minNum = parseValue(minText);
    const maxNum = parseValue(maxText);

    // Update both fields
    setMinText(minNum?.toString() ?? "");
    onChange({ min: minNum, max: maxNum });
  };

  const handleMaxBlur = () => {
    const minNum = parseValue(minText);
    const maxNum = parseValue(maxText);

    // Update both fields
    setMaxText(maxNum?.toString() ?? "");
    onChange({ min: minNum, max: maxNum });
  };

  // Validation: check if min > max
  const minNum = parseValue(minText);
  const maxNum = parseValue(maxText);
  const minInvalid = minNum != null && maxNum != null && minNum > maxNum;
  const maxInvalid = minNum != null && maxNum != null && maxNum < minNum;

  return (
    <div className={cn("flex items-center gap-2 w-full", className)}>
      <Input
        type="text"
        inputMode="decimal"
        value={minText}
        onChange={(e) => handleMinChange(e.target.value)}
        onBlur={handleMinBlur}
        placeholder="Min"
        disabled={disabled}
        className={cn("h-9 flex-1", minInvalid && "border-destructive")}
      />
      <Input
        type="text"
        inputMode="decimal"
        value={maxText}
        onChange={(e) => handleMaxChange(e.target.value)}
        onBlur={handleMaxBlur}
        placeholder="Max"
        disabled={disabled}
        className={cn("h-9 flex-1", maxInvalid && "border-destructive")}
      />
      {unit && (
        <div className="flex items-center px-3 h-9 border border-border text-secondary type-p whitespace-nowrap">
          {unit}
        </div>
      )}
    </div>
  );
}