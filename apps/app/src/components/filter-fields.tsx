"use client";

import { RELATIVE_DATE_OPTIONS } from "@/config/filters";
import { useFieldOptions } from "@/hooks/use-field-options";
import { cn } from "@v1/ui/cn";
import { DatePicker } from "@v1/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { MinMaxInput } from "@v1/ui/min-max";
import { Select } from "@v1/ui/select";
import * as React from "react";
import type {
  FilterFieldConfig,
  FilterOperator,
  FilterValue,
} from "./passports/filter-types";

interface FilterFieldInputProps {
  fieldConfig: FilterFieldConfig;
  operator: FilterOperator | null | undefined;
  value: FilterValue;
  onOperatorChange: (operator: FilterOperator) => void;
  onValueChange: (value: FilterValue) => void;
}

/**
 * Integrated control that renders BOTH operator selector and value input
 * based on the field configuration. Some field types (e.g., boolean)
 * do not render an operator selector at all.
 */
export function FilterFieldInput({
  fieldConfig,
  operator,
  value,
  onOperatorChange,
  onValueChange,
}: FilterFieldInputProps) {
  // Hoist dynamic options loading to satisfy Rules of Hooks
  const { options: dynamicOptions, isLoading } = useFieldOptions(
    fieldConfig.optionsSource?.endpoint,
    fieldConfig.optionsSource?.transform,
  );

  // Boolean fields: show True/False only (no operator)
  if (fieldConfig.inputType === "boolean") {
    const boolValue = (value as boolean) ?? false;
    return (
      <div className="flex items-center gap-2 w-full">
        {/* Static operator container matching operator button size/style */}
        <div className="flex items-center justify-center type-p !leading-4 text-primary border border-border px-3 py-2.5 h-9 bg-background">
          <div className="flex items-center justify-center px-1">equals</div>
        </div>

        {/* Segmented control with sliding thumb (no track bg) */}
        <div className="relative h-9 flex-1">
          {/* Thumb */}
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-1/2 border border-border bg-background transition-transform duration-200 will-change-transform",
              boolValue ? "translate-x-full" : "translate-x-0",
            )}
          />
          {/* Labels */}
          <div className="relative z-10 grid h-full grid-cols-2">
            <button
              type="button"
              aria-pressed={!boolValue}
              aria-disabled={!boolValue}
              tabIndex={!boolValue ? -1 : 0}
              onClick={boolValue ? () => onValueChange(false) : undefined}
              className={cn(
                "flex items-center justify-center px-3 text-[14px] transition-colors",
                !boolValue
                  ? "text-primary cursor-default pointer-events-none"
                  : "text-tertiary hover:text-primary cursor-pointer",
              )}
            >
              False
            </button>
            <button
              type="button"
              aria-pressed={boolValue}
              aria-disabled={boolValue}
              tabIndex={boolValue ? -1 : 0}
              onClick={!boolValue ? () => onValueChange(true) : undefined}
              className={cn(
                "flex items-center justify-center px-3 text-[14px] transition-colors",
                boolValue
                  ? "text-primary cursor-default pointer-events-none"
                  : "text-tertiary hover:text-primary cursor-pointer",
              )}
            >
              True
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Build operator selector only when meaningful
  // Exclude number/percentage/date fields as they now have integrated controls
  const showOperator = 
    fieldConfig.operators && 
    fieldConfig.operators.length > 0 && 
    fieldConfig.inputType !== "number" && 
    fieldConfig.inputType !== "percentage" &&
    fieldConfig.inputType !== "date";

  // Helper: some operators do not require a value
  const operatorNeedsNoValue = operator === "is empty" || operator === "is not empty";

  // Route rendering by input type
  const renderValueControl = () => {
    switch (fieldConfig.inputType) {
      case "text":
        return operatorNeedsNoValue ? null : (
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={fieldConfig.placeholder ?? "Enter value..."}
            className="h-9"
          />
        );

      case "number":
      case "percentage":
        return (
          <MinMaxInput
            value={value as { min?: number; max?: number }}
            onChange={(v) => onValueChange(v)}
            unit={fieldConfig.unit}
          />
        );

      case "select": {
        const options = fieldConfig.options ?? dynamicOptions;
        return operatorNeedsNoValue ? null : (
          <Select
            options={options}
            value={value as string}
            onValueChange={onValueChange}
            placeholder="Select..."
            searchable
            loading={isLoading}
            inline
          />
        );
      }

      case "multi-select": {
        const options = fieldConfig.options ?? dynamicOptions;
        return operatorNeedsNoValue ? null : (
          <Select
            multiple
            options={options}
            value={(value as string[]) ?? []}
            onValueChange={onValueChange}
            placeholder="Select..."
            searchable
            loading={isLoading}
            inline
          />
        );
      }

      case "date": {
        const rangeValue = value as any;
        const afterDate = rangeValue?.after ? new Date(rangeValue.after) : null;
        const beforeDate = rangeValue?.before ? new Date(rangeValue.before) : null;
        
        // Validation: check if after > before
        const afterInvalid = afterDate && beforeDate && afterDate > beforeDate;
        const beforeInvalid = afterDate && beforeDate && beforeDate < afterDate;

        const handleAfterChange = (date: Date | null) => {
          const newAfter = date;
          const newBefore = beforeDate;
          
          // Automatically determine the operator based on which fields are filled
          let newOperator: FilterOperator;
          if (newAfter && newBefore) {
            newOperator = "is between" as FilterOperator;
          } else if (newAfter && !newBefore) {
            newOperator = "is after" as FilterOperator;
          } else if (!newAfter && newBefore) {
            newOperator = "is before" as FilterOperator;
          } else {
            newOperator = "is between" as FilterOperator;
          }
          
          onOperatorChange(newOperator);
          onValueChange({
            start: newAfter?.toISOString() ?? "",
            end: newBefore?.toISOString() ?? "",
          });
        };

        const handleBeforeChange = (date: Date | null) => {
          const newAfter = afterDate;
          const newBefore = date;
          
          // Automatically determine the operator based on which fields are filled
          let newOperator: FilterOperator;
          if (newAfter && newBefore) {
            newOperator = "is between" as FilterOperator;
          } else if (newAfter && !newBefore) {
            newOperator = "is after" as FilterOperator;
          } else if (!newAfter && newBefore) {
            newOperator = "is before" as FilterOperator;
          } else {
            newOperator = "is between" as FilterOperator;
          }
          
          onOperatorChange(newOperator);
          onValueChange({
            start: newAfter?.toISOString() ?? "",
            end: newBefore?.toISOString() ?? "",
          });
        };

        return (
          <div className="flex items-center gap-2 w-full">
            <DatePicker
              value={afterDate}
              onChange={handleAfterChange}
              placeholder="After"
              className={cn(afterInvalid && "[&_input]:border-destructive")}
              inline
            />
            <DatePicker
              value={beforeDate}
              onChange={handleBeforeChange}
              placeholder="Before"
              className={cn(beforeInvalid && "[&_input]:border-destructive")}
              inline
            />
          </div>
        );
      }

      case "date-relative": {
        return (
          <Select
            options={RELATIVE_DATE_OPTIONS}
            value={(value as any)?.option ?? null}
            onValueChange={(option: string) => {
              onOperatorChange("relative" as FilterOperator);
              onValueChange({ type: "relative", option: option as any });
            }}
            placeholder="Select..."
            inline
          />
        );
      }

      case "country":
        return operatorNeedsNoValue ? null : (
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={fieldConfig.placeholder ?? "Country code"}
            className="h-9"
          />
        );

      default:
        return (
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={fieldConfig.placeholder ?? "Enter value..."}
            className="h-9"
          />
        );
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {showOperator && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className={cn("justify-between", operatorNeedsNoValue ? "w-full" : "w-fit")}
              icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
            >
              <span className="truncate">{operator || "Select operator..."}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]" inline>
            {fieldConfig.operators.map((op) => (
              <DropdownMenuItem key={op} onSelect={() => onOperatorChange(op)}>
                <span>{op}</span>
                <Icons.Check
                  className={cn("h-4 w-4 ml-auto", operator === op ? "opacity-100" : "opacity-0")}
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {!operatorNeedsNoValue && <div className="flex-1 min-w-0">{renderValueControl()}</div>}
    </div>
  );
}


