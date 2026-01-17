"use client";

import { Switch } from "@v1/ui/switch";
import { Label } from "@v1/ui/label";
import type { ContentField } from "../../registry/types";

interface ToggleInputProps {
  field: ContentField;
  value: unknown;
  onChange: (value: boolean) => void;
}

/**
 * Toggle/switch input for boolean content fields.
 */
export function ToggleInput({ field, value, onChange }: ToggleInputProps) {
  const checked = typeof value === "boolean" ? value : false;
  return (
    <div className="flex items-center justify-between">
      <Label variant="small">{field.label}</Label>
      <Switch
        checked={checked}
        onCheckedChange={(newChecked) => onChange(newChecked)}
      />
    </div>
  );
}
