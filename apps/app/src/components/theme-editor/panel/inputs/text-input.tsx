"use client";

import { Input } from "@v1/ui/input";
import { FieldWrapper } from "./field-wrapper";
import type { ContentField } from "../../registry/types";

interface TextInputProps {
    field: ContentField;
    value: unknown;
    onChange: (value: string) => void;
}

/**
 * Simple text input for content fields.
 */
export function TextInput({ field, value, onChange }: TextInputProps) {
    return (
        <FieldWrapper label={field.label}>
            <Input
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder}
                className="h-8 text-sm"
            />
        </FieldWrapper>
    );
}
