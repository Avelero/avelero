"use client";

import { useEffect, useMemo, useState } from "react";
import { countries } from "@v1/location/countries";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Icons } from "@v1/ui/icons";

interface CountrySelectProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (code: string, name?: string) => void;
}

export function CountrySelect({ id, label, placeholder = "Select country", value, onChange }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(value);

  useEffect(() => {
    if (internal !== value) setInternal(value);
  }, [value, internal]);

  const options = useMemo(() => Object.values(countries), []);
  const selected = useMemo(() => options.find((c) => c.code === internal || c.name === internal), [options, internal]);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-expanded={open} className="w-full justify-between font-normal truncate">
            {internal ? selected?.name : placeholder}
            <span className="ml-2 h-4 w-4 shrink-0 opacity-50">▾</span>
          </Button>
        </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
          <Command loop>
            <CommandInput placeholder="Search country..." className="h-9 px-2" autoComplete="off" />
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              <CommandList className="overflow-y-auto max-h-[230px] pt-2">
                {options.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={country.name}
                    onSelect={() => {
                      setInternal(country.code);
                      onChange(country.code, country.name);
                      setOpen(false);
                    }}
                  >
                    {country.name}
                    <Icons.Check className={cn("ml-auto h-4 w-4", internal === country.code ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandList>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}


