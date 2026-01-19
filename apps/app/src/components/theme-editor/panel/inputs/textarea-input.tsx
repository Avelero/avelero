"use client";

import type { ContentField } from "../../registry/types";
import { FieldWrapper } from "./field-wrapper";

interface TextareaInputProps {
  field: ContentField;
  value: unknown;
  onChange: (value: string) => void;
}

/**
 * Multi-line textarea input for content fields.
 */
export function TextareaInput({ field, value, onChange }: TextareaInputProps) {
  return (
    <FieldWrapper label={field.label}>
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    </FieldWrapper>
  );
}
