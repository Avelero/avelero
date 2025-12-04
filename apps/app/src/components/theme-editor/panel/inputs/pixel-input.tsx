"use client";

import { Input } from "@v1/ui/input";
import { cn } from "@v1/ui/cn";
import { Label } from "@v1/ui/label";

interface PixelInputProps {
  label?: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Single pixel/number input with optional label and unit suffix.
 */
export function PixelInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  placeholder = "0",
  className,
}: PixelInputProps) {
  const numericValue =
    typeof value === "string" ? Number.parseFloat(value) || 0 : value;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label variant="small">{label}</Label>}
      <div className="relative">
        <Input
          type="number"
          allowEmpty
          value={numericValue}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            onChange(val);
          }}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={cn("h-8 text-sm", unit && "pr-7")}
        />
        {unit && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
