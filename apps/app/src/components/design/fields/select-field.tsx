"use client";

import { cn } from "@v1/ui/cn";
import { Select } from "@v1/ui/select";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
}: SelectFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="type-small text-secondary">{label}</span>}
      <Select
        value={value || null}
        onValueChange={onChange}
        options={options}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

// Pre-defined options for typography fields

export const FONT_WEIGHT_OPTIONS: SelectOption[] = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "700", label: "Bold" },
];

export const LINE_HEIGHT_OPTIONS: SelectOption[] = [
  { value: "1", label: "Tight" },
  { value: "1.25", label: "Normal" },
  { value: "1.5", label: "Relaxed" },
  { value: "2", label: "Double" },
];

export const LETTER_SPACING_OPTIONS: SelectOption[] = [
  { value: "-0.025em", label: "Tight" },
  { value: "0em", label: "Normal" },
  { value: "0.025em", label: "Wide" },
];
