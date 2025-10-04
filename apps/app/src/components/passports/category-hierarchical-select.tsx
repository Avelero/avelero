"use client";

import * as React from "react";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@v1/ui/command";
import { cn } from "@v1/ui/cn";
import type { SelectOption } from "./filter-types";

interface CategoryHierarchicalSelectProps {
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  options: SelectOption[];
  multiple?: boolean;
  operator?: string;
}

/**
 * Hierarchical Category Selector
 * 
 * Supports tree-structured category selection with special operators:
 * - "is" / "is not" - exact category match
 * - "is any of" - multiple category selection
 * - "is descendant of" - category or any child category
 * - "is ancestor of" - parent categories only
 * 
 * For now, displays flat list. Tree structure can be added later.
 */
export function CategoryHierarchicalSelect({
  value,
  onChange,
  options,
  multiple = false,
  operator,
}: CategoryHierarchicalSelectProps) {
  const [open, setOpen] = React.useState(false);

  // Handle array or single value
  const selectedValues = React.useMemo(() => {
    if (Array.isArray(value)) return value;
    if (value) return [value];
    return [];
  }, [value]);

  const toggleValue = (optionValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
      setOpen(false);
    }
  };

  // Display text
  const displayText = React.useMemo(() => {
    if (selectedValues.length === 0) {
      return "Select category...";
    }
    
    if (selectedValues.length === 1) {
      const selectedOption = options.find((o) => o.value === selectedValues[0]);
      return selectedOption?.label ?? selectedValues[0];
    }

    return `${selectedValues.length} categories`;
  }, [selectedValues, options]);

  // Show breadcrumb hint for "is descendant of"
  const showDescendantHint = operator === "is descendant of";

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between text-p font-normal"
          >
            <span className="truncate">{displayText}</span>
            <Icons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No categories found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => toggleValue(option.value)}
                    >
                      {multiple ? (
                        <div className="relative inline-flex h-4 w-4 items-center justify-center mr-2">
                          <input
                            type="checkbox"
                            className="block h-4 w-4 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer"
                            checked={isSelected}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {isSelected && (
                            <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
                              <div className="w-[10px] h-[10px] bg-brand" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <Icons.Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                      )}
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Hint for hierarchical operators */}
      {showDescendantHint && selectedValues.length > 0 && (
        <div className="text-small text-tertiary italic">
          Includes all sub-categories
        </div>
      )}
    </div>
  );
}

