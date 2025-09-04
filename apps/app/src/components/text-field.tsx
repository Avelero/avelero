"use client";

import { Input } from "@v1/ui/input";

interface TextFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextField({
  id,
  label,
  placeholder,
  helperText,
  value,
  onChange,
}: TextFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
