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
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { Select } from "@v1/ui/select";
import * as React from "react";
import { FilterFieldInput } from "./filter-fields";
import type {
  FilterCondition,
  FilterFieldConfig,
  FilterGroup as FilterGroupType,
  FilterOperator,
} from "./passports/filter-types";

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
    ? getFieldConfig(condition.fieldId, true) // Use advanced filters transformation
    : null;
  const isUnselected = !fieldConfig;

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
    const newFieldConfig = getFieldConfig(fieldId, true); // Use advanced filters transformation
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
        "flex items-center gap-2 w-full",
        boxed && "p-3 border border-border bg-background",
        isNested && "bg-accent/20",
      )}
    >
      {/* Field Selector */}
      <div className={cn(isUnselected ? "flex-1 min-w-0" : "flex-none")}>
        <Select
          options={categorizedFields.flatMap(({ fields }) =>
            fields.map((f) => ({ value: f.id, label: f.label })),
          )}
          value={condition.fieldId ?? null}
          onValueChange={handleFieldSelect}
          placeholder="Select field..."
          searchable
          searchPlaceholder="Search fields..."
          className={isUnselected ? "w-full" : "w-fit"}
          inline
        />
      </div>

      {/* Integrated Operator + Value Input */}
      {fieldConfig && (
        <div className="flex-1 min-w-0">
          <FilterFieldInput
            fieldConfig={fieldConfig}
            operator={condition.operator}
            value={condition.value}
            onOperatorChange={(op) => handleOperatorSelect(op)}
            onValueChange={(val) => handleValueChange(val)}
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
        <DropdownMenuContent align="end" className="w-[160px]" inline>
          {!isInGroup && onConvertToGroup && (
            <DropdownMenuItem onSelect={onConvertToGroup}>
              Convert to group
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
            <Icons.Trash2 className="h-4 w-4" /> Delete filter
          </DropdownMenuItem>
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

export function FilterGroup({
  group,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  onRemoveGroup,
  availableFields,
}: FilterGroupProps) {
  return (
    <div className="border border-border bg-background p-4 space-y-2 w-full">
      {/* Conditions with OR separators */}
      {group.conditions.map((condition, index) => (
        <React.Fragment key={condition.id}>
          {index > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-accent-dark" />
              <span className="type-small font-medium text-secondary uppercase tracking-wide">
                or
              </span>
              <div className="h-px flex-1 bg-accent-dark" />
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
          <Icons.Plus className="h-4 w-4 mr-1.5" /> Create filter
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemoveGroup}>
          <Icons.Trash2 className="h-4 w-4 mr-1.5" /> Delete group
        </Button>
      </div>
    </div>
  );
}
