"use client";

import type { ContentField } from "@v1/dpp-components";
import { Textarea } from "@v1/ui/textarea";
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
      <Textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="min-h-[80px] max-h-none resize-y text-sm"
      />
    </FieldWrapper>
  );
}
