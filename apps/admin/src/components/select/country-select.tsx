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
import { useEffect, useMemo, useRef, useState } from "react";

interface CountrySelectProps {
  id: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (code: string, name?: string) => void;
  className?: string;
  container?: HTMLElement | null;
}

export function CountrySelect({
  id,
  label,
  placeholder = "Select country...",
  value,
  onChange,
  className,
  container,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearchTerm("");
    }
  }, [open]);

  const options = useMemo(
    () =>
      Object.values(countries).map((country) => ({
        value: country.code,
        label: country.name,
      })),
    [],
  );

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const query = searchTerm.toLowerCase().trim();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [options, searchTerm]);

  const selectedOption = options.find((option) => option.value === value);
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
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select open={open} onOpenChange={setOpen}>
        <SelectTrigger asChild>
          <Button
            id={id}
            variant="outline"
            size="default"
            className="w-full justify-between data-[state=open]:bg-accent"
          >
            <span
              className={cn("truncate px-1", isPlaceholder ? "text-tertiary" : "")}
            >
              {displayValue}
            </span>
            <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
          </Button>
        </SelectTrigger>
        <SelectContent shouldFilter={false} container={container}>
          <SelectSearch
            ref={inputRef}
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
                    <span className="px-1">{option.label}</span>
                    {value === option.value ? (
                      <Icons.Check className="h-4 w-4" />
                    ) : null}
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
