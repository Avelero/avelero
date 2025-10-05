"use client";

import {
  getAdvancedFieldsByCategoryForUI,
  getFieldConfig,
} from "@/config/filters";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import * as React from "react";
import type {
  FilterCondition,
  FilterFieldConfig,
  FilterGroup as FilterGroupType,
  FilterOperator,
} from "./passports/filter-types";
import { FilterValueInput } from "./passports/filter-value-input";

// ============================================================================
// FilterRow Component
// ============================================================================

interface FilterRowProps {
  groupId: string;
  condition: FilterCondition;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onDelete: () => void;
  onConvertToGroup?: () => void; // Only for standalone filters
  availableFields?: FilterFieldConfig[];
  isNested?: boolean;
  isInGroup?: boolean; // Controls menu options
  boxed?: boolean; // Adds padding/border background when true
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
  onDelete,
  onConvertToGroup,
  availableFields,
  isNested = false,
  isInGroup = false,
  boxed = false,
}: FilterRowProps) {
  const fieldConfig = condition.fieldId
    ? getFieldConfig(condition.fieldId)
    : null;
  const isUnselected = !fieldConfig;

  const [fieldPopoverOpen, setFieldPopoverOpen] = React.useState(false);

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
    setFieldPopoverOpen(false);
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
        "flex items-center gap-2 w-full",
        boxed && "p-3 border border-border bg-background",
        isNested && "bg-accent/20",
      )}
    >
      {/* Field Selector */}
      <div className={cn(isUnselected ? "flex-1 min-w-0" : "flex-none")}>
        <Popover open={fieldPopoverOpen} onOpenChange={setFieldPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 justify-between text-p font-normal px-3",
                isUnselected ? "w-full" : "w-auto",
              )}
            >
              <span className="truncate">
                {fieldConfig?.label ?? "Select field..."}
              </span>
              <Icons.ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] p-0" inline>
            <Command
              loop
              className={cn(
                "[&_[cmdk-group-heading]]:px-2",
                "[&_[cmdk-group-heading]]:text-secondary",
                "[&_[cmdk-group-heading]]:font-medium",
                "[&_[cmdk-group-heading]]:py-1",
                "[&_[cmdk-group-heading]]:bg-transparent",
              )}
            >
              <CommandInput
                placeholder="Search fields..."
                className="h-9 px-2"
                autoComplete="off"
              />
              <CommandEmpty>No fields found.</CommandEmpty>
              <CommandList className="max-h-[320px]">
                  {categorizedFields.map(({ category, label, fields }) => (
                    <CommandGroup key={category} heading={label}>
                      {fields.map((field) => (
                        <CommandItem
                          key={field.id}
                          value={field.label}
                          onSelect={() => handleFieldSelect(field.id)}
                        >
                          <span className="text-p">{field.label}</span>
                          <Icons.Check
                            className={cn(
                              "ml-auto h-4 w-4",
                              condition.fieldId === field.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Operator Selector */}
      {fieldConfig && (
        <div className="flex-none">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-auto justify-between text-p font-normal px-3"
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

      {/* Actions Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Filter options">
            <Icons.EllipsisVertical className="w-4 h-4" strokeWidth={1} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onSelect={onDelete}>Delete filter</DropdownMenuItem>
          {!isInGroup && onConvertToGroup && (
            <DropdownMenuItem onSelect={onConvertToGroup}>
              Convert to group
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// FilterGroup Component
// ============================================================================

interface FilterGroupProps {
  group: FilterGroupType;
  onAddCondition: () => void;
  onUpdateCondition: (
    conditionId: string,
    updates: Partial<FilterCondition>,
  ) => void;
  onRemoveCondition: (conditionId: string) => void;
  onRemoveGroup: () => void;
  availableFields?: FilterFieldConfig[];
}

/**
 * Filter Group Component
 *
 * Wraps multiple FilterRow components with OR logic.
 * Multiple groups are combined with AND logic at a higher level.
 *
 * Structure:
 * - Group Label (AND/WHERE)
 * - FilterRow 1
 * - OR divider
 * - FilterRow 2
 * - [+ OR] button
 * - Remove group button
 */
export function FilterGroup({
  group,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  onRemoveGroup,
  availableFields,
}: FilterGroupProps) {
  return (
    <div className="border border-border bg-background p-4 space-y-2">
      {/* Conditions with OR separators */}
      {group.conditions.map((condition, index) => (
        <React.Fragment key={condition.id}>
          {index > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-small font-medium text-secondary uppercase tracking-wide">
                or
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <FilterRow
            groupId={group.id}
            condition={condition}
            onUpdate={(updates) => onUpdateCondition(condition.id, updates)}
            onDelete={() => onRemoveCondition(condition.id)}
            availableFields={availableFields}
            isInGroup
          />
        </React.Fragment>
      ))}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onAddCondition}>
          <Icons.Plus className="h-4 w-4 mr-1" /> Create filter
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemoveGroup}>
          Delete group
        </Button>
      </div>
    </div>
  );
}

