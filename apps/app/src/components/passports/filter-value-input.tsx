"use client";

import { RELATIVE_DATE_OPTIONS } from "@/config/filters";
import { useFieldOptions } from "@/hooks/use-field-options";
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
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import * as React from "react";
import type {
  FilterFieldConfig,
  FilterOperator,
  FilterValue,
  SelectOption,
} from "./filter-types";

interface FilterValueInputProps {
  fieldConfig: FilterFieldConfig;
  operator: FilterOperator;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

/**
 * Smart router component that renders the appropriate input type
 * based on field configuration and operator
 */
export function FilterValueInput({
  fieldConfig,
  operator,
  value,
  onChange,
}: FilterValueInputProps) {
  // Handle operators that don't need value input
  if (operator === "is empty" || operator === "is not empty") {
    return (
      <div className="text-p text-tertiary italic px-3 py-2">
        No value needed
      </div>
    );
  }

  // Route to appropriate input component
  switch (fieldConfig.inputType) {
    case "text":
      return (
        <TextInput
          value={value}
          onChange={onChange}
          placeholder={fieldConfig.placeholder}
        />
      );

    case "number":
    case "percentage":
      return (
        <NumberInput
          value={value}
          onChange={onChange}
          operator={operator}
          unit={fieldConfig.unit}
          placeholder={fieldConfig.placeholder}
        />
      );

    case "boolean":
      return <BooleanInput value={value} onChange={onChange} />;

    case "select":
      return (
        <SelectInput
          value={value}
          onChange={onChange}
          fieldConfig={fieldConfig}
        />
      );

    case "multi-select":
      return (
        <MultiSelectInput
          value={value}
          onChange={onChange}
          fieldConfig={fieldConfig}
        />
      );

    case "date":
      return (
        <DateInput value={value} onChange={onChange} operator={operator} />
      );

    case "date-relative":
      return <RelativeDateInput value={value} onChange={onChange} />;

    case "country":
      // Note: We have a country-select.tsx component we could import
      return (
        <TextInput
          value={value}
          onChange={onChange}
          placeholder="Country code"
        />
      );

    default:
      return <TextInput value={value} onChange={onChange} />;
  }
}

// =============================================================================
// Text Input
// =============================================================================

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="text"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Enter value..."}
      className="h-9"
    />
  );
}

// =============================================================================
// Number Input
// =============================================================================

function NumberInput({
  value,
  onChange,
  operator,
  unit,
  placeholder,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  operator: FilterOperator;
  unit?: string;
  placeholder?: string;
}) {
  // Handle "between" operator with two inputs
  if (operator === "between") {
    const rangeValue = value as any;
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={rangeValue?.min ?? ""}
          onChange={(e) =>
            onChange({
              min: Number.parseFloat(e.target.value),
              max: rangeValue?.max ?? 0,
            })
          }
          placeholder="Min"
          className="h-9 flex-1"
        />
        <span className="text-tertiary">–</span>
        <Input
          type="number"
          value={rangeValue?.max ?? ""}
          onChange={(e) =>
            onChange({
              min: rangeValue?.min ?? 0,
              max: Number.parseFloat(e.target.value),
            })
          }
          placeholder="Max"
          className="h-9 flex-1"
        />
        {unit && <span className="text-tertiary text-p">{unit}</span>}
      </div>
    );
  }

  // Single number input
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={(value as number) ?? ""}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        placeholder={placeholder ?? "0"}
        className="h-9 flex-1"
      />
      {unit && (
        <span className="text-tertiary text-p whitespace-nowrap">{unit}</span>
      )}
    </div>
  );
}

// =============================================================================
// Boolean Input
// =============================================================================

function BooleanInput({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}) {
  const boolValue = value as boolean;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={boolValue === true ? "brand" : "outline"}
        size="sm"
        onClick={() => onChange(true)}
        className="flex-1"
      >
        True
      </Button>
      <Button
        variant={boolValue === false ? "brand" : "outline"}
        size="sm"
        onClick={() => onChange(false)}
        className="flex-1"
      >
        False
      </Button>
    </div>
  );
}

// =============================================================================
// Select Input (Single Select)
// =============================================================================

function SelectInput({
  value,
  onChange,
  fieldConfig,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  fieldConfig: FilterFieldConfig;
}) {
  const [open, setOpen] = React.useState(false);

  // Get options from static list or dynamic fetch
  const { options: dynamicOptions, isLoading } = useFieldOptions(
    fieldConfig.optionsSource?.endpoint,
    fieldConfig.optionsSource?.transform,
  );

  const options = fieldConfig.options ?? dynamicOptions;
  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? "Select...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between text-p font-normal"
        >
          <span className="truncate">{selectedLabel}</span>
          <Icons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No results found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Icons.Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// Multi-Select Input
// =============================================================================

export function MultiSelectInput({
  value,
  onChange,
  fieldConfig,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  fieldConfig: FilterFieldConfig;
}) {
  const [open, setOpen] = React.useState(false);

  // Get options from static list or dynamic fetch
  const { options: dynamicOptions, isLoading } = useFieldOptions(
    fieldConfig.optionsSource?.endpoint,
    fieldConfig.optionsSource?.transform,
  );

  const options = fieldConfig.options ?? dynamicOptions;
  const selectedValues = (value as string[]) ?? [];

  const toggleValue = (optionValue: string) => {
    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter((v) => v !== optionValue)
      : [...selectedValues, optionValue];
    onChange(newValues);
  };

  const displayText =
    selectedValues.length === 0
      ? "Select..."
      : selectedValues.length === 1
        ? options.find((o) => o.value === selectedValues[0])?.label
        : `${selectedValues.length} selected`;

  return (
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
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No results found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => toggleValue(option.value)}
                  >
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
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// Date Input
// =============================================================================

function DateInput({
  value,
  onChange,
  operator,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  operator: FilterOperator;
}) {
  const [open, setOpen] = React.useState(false);

  // Handle "is between" with date range
  if (operator === "is between") {
    const rangeValue = value as any;
    const startDate = rangeValue?.start
      ? new Date(rangeValue.start)
      : undefined;
    const endDate = rangeValue?.end ? new Date(rangeValue.end) : undefined;

    return (
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={
            rangeValue?.start
              ? new Date(rangeValue.start).toISOString().split("T")[0]
              : ""
          }
          onChange={(e) => {
            onChange({
              start: e.target.value
                ? new Date(e.target.value).toISOString()
                : "",
              end: rangeValue?.end ?? "",
            });
          }}
          className="h-9 flex-1"
        />
        <span className="text-tertiary">–</span>
        <Input
          type="date"
          value={
            rangeValue?.end
              ? new Date(rangeValue.end).toISOString().split("T")[0]
              : ""
          }
          onChange={(e) => {
            onChange({
              start: rangeValue?.start ?? "",
              end: e.target.value ? new Date(e.target.value).toISOString() : "",
            });
          }}
          className="h-9 flex-1"
        />
      </div>
    );
  }

  // Single date picker
  const dateValue = value as any;
  const selectedDate = dateValue?.date
    ? new Date(dateValue.date).toISOString().split("T")[0]
    : "";

  return (
    <Input
      type="date"
      value={selectedDate}
      onChange={(e) => {
        onChange({
          date: e.target.value ? new Date(e.target.value).toISOString() : "",
        });
      }}
      className="h-9"
    />
  );
}

// =============================================================================
// Relative Date Input
// =============================================================================

function RelativeDateInput({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const relativeValue = value as any;
  const selectedOption = relativeValue?.option ?? "";
  const selectedLabel =
    RELATIVE_DATE_OPTIONS.find((o) => o.value === selectedOption)?.label ??
    "Select...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between text-p font-normal"
        >
          <span className="truncate">{selectedLabel}</span>
          <Icons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {RELATIVE_DATE_OPTIONS.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange({
                      type: "relative",
                      option: option.value as any,
                    });
                    setOpen(false);
                  }}
                >
                  <Icons.Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedOption === option.value
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
