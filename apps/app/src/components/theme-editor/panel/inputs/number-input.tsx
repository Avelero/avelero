"use client";

import { useState, useEffect } from "react";
import { Input } from "@v1/ui/input";
import { FieldWrapper } from "./field-wrapper";
import type { ContentField } from "../../registry/types";

interface NumberInputProps {
  field: ContentField;
  value: unknown;
  onChange: (value: number) => void;
}

/**
 * Number input for content fields with min/max support.
 */
export function NumberInput({ field, value, onChange }: NumberInputProps) {
  const [localValue, setLocalValue] = useState<string>(() => {
    const numValue = typeof value === "number" ? value : 0;
    return String(numValue);
  });

  // Sync localValue when value prop changes (e.g., from undo/redo)
  useEffect(() => {
    const numValue = typeof value === "number" ? value : 0;
    setLocalValue(String(numValue));
  }, [value]);

  return (
    <FieldWrapper label={field.label}>
      <Input
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          const parsed = Number(localValue);
          if (!Number.isNaN(parsed)) {
            onChange(parsed);
          } else {
            // Reset to current value if invalid
            const numValue = typeof value === "number" ? value : 0;
            setLocalValue(String(numValue));
          }
        }}
        min={field.min}
        max={field.max}
        className="h-8 text-sm w-24"
      />
    </FieldWrapper>
  );
}
