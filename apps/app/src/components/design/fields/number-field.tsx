"use client";

import { Input } from "@v1/ui/input";
import { cn } from "@v1/ui/cn";

interface NumberFieldProps {
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

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  placeholder = "0",
  className,
}: NumberFieldProps) {
  const numericValue = typeof value === "string" ? Number.parseFloat(value) || 0 : value;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="type-small text-secondary">{label}</span>}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={numericValue}
          onChange={(e) => {
            let val = Number.parseFloat(e.target.value) || 0;
            if (min !== undefined) val = Math.max(min, val);
            if (max !== undefined) val = Math.min(max, val);
            onChange(val);
          }}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className="h-8 flex-1 text-sm"
        />
        {unit && <span className="type-small text-secondary">{unit}</span>}
      </div>
    </div>
  );
}

interface FourSideInputProps {
  label: string;
  values: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  onChange: (values: { top: number; right: number; bottom: number; left: number }) => void;
  unit?: string;
  className?: string;
}

export function FourSideInput({
  label,
  values,
  onChange,
  unit = "px",
  className,
}: FourSideInputProps) {
  const handleChange = (side: keyof typeof values, value: number) => {
    onChange({ ...values, [side]: value });
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="type-small text-secondary">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {/* Top-Left and Top-Right row */}
        <div className="flex items-center gap-1">
          <span className="type-small text-tertiary w-3">⌜</span>
          <Input
            type="number"
            value={values.top}
            onChange={(e) => handleChange("top", Number.parseFloat(e.target.value) || 0)}
            className="h-8 flex-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="type-small text-tertiary w-3">⌝</span>
          <Input
            type="number"
            value={values.right}
            onChange={(e) => handleChange("right", Number.parseFloat(e.target.value) || 0)}
            className="h-8 flex-1 text-sm"
          />
        </div>
        {/* Bottom-Left and Bottom-Right row */}
        <div className="flex items-center gap-1">
          <span className="type-small text-tertiary w-3">⌞</span>
          <Input
            type="number"
            value={values.bottom}
            onChange={(e) => handleChange("bottom", Number.parseFloat(e.target.value) || 0)}
            className="h-8 flex-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="type-small text-tertiary w-3">⌟</span>
          <Input
            type="number"
            value={values.left}
            onChange={(e) => handleChange("left", Number.parseFloat(e.target.value) || 0)}
            className="h-8 flex-1 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

