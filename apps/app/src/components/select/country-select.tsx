"use client";

import { countries } from "@v1/selections/countries";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectSearch,
  SelectTrigger,
} from "@v1/ui/select";
import { useMemo, useState } from "react";

interface CountrySelectProps {
  id: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (code: string, name?: string) => void;
  className?: string;
}

export function CountrySelect({
  id,
  label,
  placeholder = "Select country...",
  value,
  onChange,
  className,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const options = useMemo(
    () =>
      Object.values(countries).map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const query = searchTerm.toLowerCase().trim();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [options, searchTerm]);

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption?.label || placeholder;
  const isPlaceholder = !selectedOption;

  const handleSelect = (code: string) => {
    const country = countries[code as keyof typeof countries];
    onChange(code, country?.name);
    setOpen(false);
    setSearchTerm("");
  };

  return (
    <div className={cn("space-y-1.5 w-full", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Select open={open} onOpenChange={setOpen}>
        <SelectTrigger asChild>
          <Button
            variant="outline"
            size="default"
            className="w-full justify-between"
          >
            <span
              className={cn("truncate px-1", isPlaceholder && "text-tertiary")}
            >
              {displayValue}
            </span>
            <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
          </Button>
        </SelectTrigger>
        <SelectContent shouldFilter={false}>
          <SelectSearch
            placeholder="Search..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <SelectList>
            {filteredOptions.length > 0 ? (
              <SelectGroup>
                {filteredOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <span className="type-p">{option.label}</span>
                    {value === option.value && (
                      <Icons.Check className="h-4 w-4" />
                    )}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : (
              <SelectEmpty>No items found.</SelectEmpty>
            )}
          </SelectList>
        </SelectContent>
      </Select>
    </div>
  );
}
