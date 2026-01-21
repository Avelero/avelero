"use client";

import { Input } from "@v1/ui/input";
import type { ContentField } from "../../registry/types";
import { FieldWrapper } from "./field-wrapper";

interface UrlInputProps {
  field: ContentField;
  value: unknown;
  onChange: (value: string) => void;
}

/**
 * URL input for content fields.
 */
export function UrlInput({ field, value, onChange }: UrlInputProps) {
  return (
    <FieldWrapper label={field.label}>
      <Input
        type="url"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || "https://..."}
        className="h-8 text-sm"
      />
    </FieldWrapper>
  );
}
