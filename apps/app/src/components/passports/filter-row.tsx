"use client";

import {
  getAdvancedFieldsByCategoryForUI,
  getFieldConfig,
} from "@/config/filters";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import type {
  FilterCondition,
  FilterFieldConfig,
  FilterOperator,
} from "./filter-types";
import { FilterValueInput } from "./filter-value-input";

interface FilterRowProps {
  groupId: string;
  condition: FilterCondition;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
  availableFields?: FilterFieldConfig[];
  isNested?: boolean;
  showRemove?: boolean;
}

/**
 * Core reusable filter row component
 *
 * Displays the Field → Operator → Value pattern with dropdowns for
 * field selection and operator selection, plus dynamic value input.
 *
 * Can be used for both top-level filters and nested conditions.
 */
export function FilterRow({
  groupId,
  condition,
  onUpdate,
  onRemove,
  availableFields,
  isNested = false,
  showRemove = true,
}: FilterRowProps) {
  const fieldConfig = condition.fieldId
    ? getFieldConfig(condition.fieldId)
    : null;

  // Get categorized fields if not provided
  const categorizedFields = React.useMemo(() => {
    if (availableFields) {
      return [
        { category: "all", label: "All Fields", fields: availableFields },
      ];
    }
    return getAdvancedFieldsByCategoryForUI();
  }, [availableFields]);

  // Handle field selection
  const handleFieldSelect = (fieldId: string) => {
    const newFieldConfig = getFieldConfig(fieldId);
    if (!newFieldConfig) return;

    // Reset operator and value when field changes
    const defaultOperator = newFieldConfig.operators[0];
    onUpdate({
      fieldId,
      operator: defaultOperator,
      value: null,
    });
  };

  // Handle operator selection
  const handleOperatorSelect = (operator: FilterOperator) => {
    onUpdate({ operator, value: null });
  };

  // Handle value change
  const handleValueChange = (value: any) => {
    onUpdate({ value });
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 p-3 border border-border bg-background",
        isNested && "bg-accent/20",
      )}
    >
      {/* Field Selector */}
      <div className="flex-1 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 w-full justify-between text-p font-normal"
            >
              <span className="truncate">
                {fieldConfig?.label ?? "Select field..."}
              </span>
              <Icons.ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[280px] max-h-[400px] overflow-y-auto"
          >
            {categorizedFields.map(({ category, label, fields }) => (
              <React.Fragment key={category}>
                {categorizedFields.length > 1 && (
                  <DropdownMenuLabel className="text-xs text-tertiary">
                    {label}
                  </DropdownMenuLabel>
                )}
                {fields.map((field) => (
                  <DropdownMenuItem
                    key={field.id}
                    onSelect={() => handleFieldSelect(field.id)}
                    className="flex items-start gap-2"
                  >
                    <Icons.Check
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        condition.fieldId === field.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-p">{field.label}</span>
                      {field.description && (
                        <span className="text-small text-tertiary line-clamp-2">
                          {field.description}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
                {categorizedFields.length > 1 &&
                  category !==
                    categorizedFields[categorizedFields.length - 1]
                      ?.category && <DropdownMenuSeparator />}
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Operator Selector */}
      {fieldConfig && (
        <div className="flex-1 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-full justify-between text-p font-normal"
              >
                <span className="truncate">
                  {condition.operator || "Select operator..."}
                </span>
                <Icons.ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {fieldConfig.operators.map((operator) => (
                <DropdownMenuItem
                  key={operator}
                  onSelect={() => handleOperatorSelect(operator)}
                >
                  <Icons.Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      condition.operator === operator
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {operator}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Value Input */}
      {fieldConfig && condition.operator && (
        <div className="flex-1 min-w-0">
          <FilterValueInput
            fieldConfig={fieldConfig}
            operator={condition.operator}
            value={condition.value}
            onChange={handleValueChange}
          />
        </div>
      )}

      {/* Remove Button */}
      {showRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label="Remove filter"
          className="h-9 w-9 p-0 shrink-0"
        >
          <Icons.X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
