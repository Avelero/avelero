"use client";

import * as React from "react";
import { cn } from "../utils";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Icons } from "./icons";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

interface BaseSelectProps {
  options?: SelectOption[];
  groups?: SelectOptionGroup[]; // For grouped options display
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
  hasCreateOption?: boolean;
  onCreateNew?: (searchTerm: string) => void;
  createLabel?: string;
  className?: string;
  width?: string; // Custom popover width class (e.g., "w-[200px]")
  inline?: boolean; // Prevents portal rendering for nested contexts like sheets
  footer?: React.ReactNode; // Custom footer content (e.g., "Add custom" button)
}

interface SingleSelectProps extends BaseSelectProps {
  multiple?: false;
  value: string | null;
  onValueChange: (value: string) => void;
}

interface MultiSelectProps extends BaseSelectProps {
  multiple: true;
  value: string[];
  onValueChange: (values: string[]) => void;
}

type SelectProps = SingleSelectProps | MultiSelectProps;

export function Select(props: SelectProps) {
  const {
    options = [],
    groups,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    searchable = false,
    disabled = false,
    loading = false,
    emptyText = "No results found.",
    hasCreateOption = false,
    onCreateNew,
    createLabel = "Create",
    className,
    width = "w-[300px]",
    inline = false,
    footer,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const isMultiple = props.multiple === true;
  const selectedValues = isMultiple
    ? props.value
    : props.value
      ? [props.value]
      : [];

  // Flatten all options (from both flat options and groups) for lookups
  const allOptions = React.useMemo(() => {
    if (groups) {
      return groups.flatMap((g) => g.options);
    }
    return options;
  }, [options, groups]);

  // Filter options based on search term (for flat options mode)
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );
  }, [options, searchTerm]);

  // Filter groups based on search term (for grouped options mode)
  const filteredGroups = React.useMemo(() => {
    if (!groups) return undefined;
    if (!searchTerm) return groups;

    const lowerSearch = searchTerm.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          option.label.toLowerCase().includes(lowerSearch),
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, searchTerm]);

  // Check if we have any filtered results
  const hasFilteredResults = groups
    ? (filteredGroups?.length ?? 0) > 0
    : filteredOptions.length > 0;

  // Display text for trigger button
  const displayText = React.useMemo(() => {
    if (selectedValues.length === 0) return placeholder;

    if (isMultiple) {
      if (selectedValues.length === 1) {
        return (
          allOptions.find((o) => o.value === selectedValues[0])?.label ??
          placeholder
        );
      }
      return `${selectedValues.length} selected`;
    }

    return (
      allOptions.find((o) => o.value === selectedValues[0])?.label ??
      placeholder
    );
  }, [selectedValues, allOptions, placeholder, isMultiple]);

  // Get selected option for displaying icon
  const selectedOption = React.useMemo(() => {
    if (selectedValues.length === 1) {
      return allOptions.find((o) => o.value === selectedValues[0]);
    }
    return undefined;
  }, [selectedValues, allOptions]);

  // Handle selection
  const handleSelect = (value: string) => {
    if (isMultiple) {
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
      (props as MultiSelectProps).onValueChange(newValues);
    } else {
      (props as SingleSelectProps).onValueChange(value);
      setOpen(false);
    }
  };

  // Handle create new
  const handleCreate = () => {
    const trimmedSearch = searchTerm.trim();
    if (onCreateNew && trimmedSearch) {
      onCreateNew(trimmedSearch);
      setSearchTerm("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-2">
              {selectedOption?.icon && (
                <div className="flex items-center justify-center w-[14px] h-[14px] shrink-0 [&>svg]:!w-[14px] [&>svg]:!h-[14px]">
                  {selectedOption.icon}
                </div>
              )}
              <span
                className={cn(
                  "truncate px-1",
                  selectedValues.length === 0 && "text-tertiary",
                )}
              >
                {displayText}
              </span>
            </div>
            <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px]",
          "p-0",
        )}
        align="start"
        inline={inline}
      >
        <Command shouldFilter={false}>
          {searchable && (
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
          )}
          <CommandList className="max-h-48">
            {!hasCreateOption && (
              <CommandEmpty>{loading ? "Loading..." : emptyText}</CommandEmpty>
            )}
            {hasCreateOption && !hasFilteredResults && !searchTerm.trim() && (
              <CommandEmpty>Start typing to create...</CommandEmpty>
            )}

            {/* Grouped options mode */}
            {filteredGroups
              ? filteredGroups.map((group) => (
                  <CommandGroup key={group.label} heading={group.label}>
                    {group.options.map((option) => {
                      const isSelected = selectedValues.includes(option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          disabled={option.disabled}
                          onSelect={() => handleSelect(option.value)}
                          className="justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {option.icon && (
                              <div className="flex items-center justify-center w-[14px] h-[14px] shrink-0 [&>svg]:!w-[14px] [&>svg]:!h-[14px]">
                                {option.icon}
                              </div>
                            )}
                            <span>{option.label}</span>
                          </div>
                          <Icons.Check
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))
              : /* Flat options mode */
                filteredOptions.length > 0 && (
                  <CommandGroup>
                    {filteredOptions.map((option) => {
                      const isSelected = selectedValues.includes(option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          disabled={option.disabled}
                          onSelect={() => handleSelect(option.value)}
                          className="justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {option.icon && (
                              <div className="flex items-center justify-center w-[14px] h-[14px] shrink-0 [&>svg]:!w-[14px] [&>svg]:!h-[14px]">
                                {option.icon}
                              </div>
                            )}
                            <span>{option.label}</span>
                          </div>
                          <Icons.Check
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

            {/* Create new option */}
            {hasCreateOption && !hasFilteredResults && searchTerm.trim() && (
              <CommandGroup>
                <CommandItem value={searchTerm.trim()} onSelect={handleCreate}>
                  <div className="flex items-center gap-2">
                    <Icons.Plus className="h-3.5 w-3.5" />
                    <span className="type-p text-primary">
                      {createLabel} &quot;{searchTerm.trim()}&quot;
                    </span>
                  </div>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>

          {/* Custom footer */}
          {footer && <div className="border-t border-border">{footer}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
