"use client";

import { countries } from "@v1/selections/countries";
import { cn } from "@v1/ui/cn";
import { Label } from "@v1/ui/label";
import { Select } from "@v1/ui/select";
import { useMemo } from "react";

interface CountrySelectProps {
  id: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (code: string, name?: string) => void;
  className?: string;
}

/**
 * Renders a country dropdown with search and invokes a callback when the selection changes.
 *
 * @param id - The HTML id used for the select and label linkage.
 * @param label - Optional label text displayed above the select.
 * @param placeholder - Placeholder text shown when no country is selected.
 * @param value - Currently selected country code.
 * @param onChange - Called when a country is selected; receives the selected country code and the country name if available.
 * @param className - Optional additional CSS class names applied to the wrapper.
 * @returns A React element containing the labeled, searchable country select.
 */
export function CountrySelect({
  id,
  label,
  placeholder = "Select country",
  value,
  onChange,
  className,
}: CountrySelectProps) {
  const options = useMemo(
    () => Object.values(countries).map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Select
        options={options}
        value={value}
        onValueChange={(code) => {
          const country = countries[code as keyof typeof countries];
          onChange(code, country?.name);
        }}
        placeholder={placeholder}
        searchable
        searchPlaceholder="Search country..."
        inline
      />
    </div>
  );
}