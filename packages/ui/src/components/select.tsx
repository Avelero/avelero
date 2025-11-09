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

interface BaseSelectProps {
  options: SelectOption[];
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
    options,
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
  } = props;

  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const isMultiple = props.multiple === true;
  const selectedValues = isMultiple
    ? props.value
    : props.value
      ? [props.value]
      : [];

  // Filter options based on search term
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );
  }, [options, searchTerm]);

  // Display text for trigger button
  const displayText = React.useMemo(() => {
    if (selectedValues.length === 0) return placeholder;

    if (isMultiple) {
      if (selectedValues.length === 1) {
        return (
          options.find((o) => o.value === selectedValues[0])?.label ??
          placeholder
        );
      }
      return `${selectedValues.length} selected`;
    }

    return (
      options.find((o) => o.value === selectedValues[0])?.label ?? placeholder
    );
  }, [selectedValues, options, placeholder, isMultiple]);

  // Get selected option for displaying icon
  const selectedOption = React.useMemo(() => {
    if (selectedValues.length === 1) {
      return options.find((o) => o.value === selectedValues[0]);
    }
    return undefined;
  }, [selectedValues, options]);

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
          icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedOption?.icon && (
              <div className="flex items-center justify-center w-[14px] h-[14px] shrink-0 [&>svg]:!w-[14px] [&>svg]:!h-[14px]">
                {selectedOption.icon}
              </div>
            )}
            <span
              className={cn(
                "truncate",
                selectedValues.length === 0 ? "text-tertiary" : "text-primary",
              )}
            >
              {displayText}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(width, "p-0")}
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
          <CommandList>
            {!hasCreateOption && (
              <CommandEmpty>{loading ? "Loading..." : emptyText}</CommandEmpty>
            )}
            {hasCreateOption &&
              filteredOptions.length === 0 &&
              !searchTerm.trim() && (
                <div className="px-3 py-9 text-center">
                  <p className="type-p text-tertiary">Start typing to create</p>
                </div>
              )}
            <CommandGroup>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
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
                      {isMultiple ? (
                        <div className="relative inline-flex h-4 w-4 items-center justify-center">
                          <input
                            type="checkbox"
                            className="block h-4 w-4 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer"
                            checked={isSelected}
                            readOnly
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
                            "h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                      )}
                    </CommandItem>
                  );
                })
              ) : hasCreateOption && searchTerm.trim() ? (
                <CommandItem value={searchTerm.trim()} onSelect={handleCreate}>
                  <div className="flex items-center gap-2">
                    <Icons.Plus className="h-3.5 w-3.5" />
                    <span className="type-p text-primary">
                      {createLabel} &quot;{searchTerm.trim()}&quot;
                    </span>
                  </div>
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
