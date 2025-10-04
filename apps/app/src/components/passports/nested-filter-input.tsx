"use client";

import { FILTER_FIELDS, getFieldConfig } from "@/config/filters";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import { FilterRow } from "./filter-row";
import type {
  FilterCondition,
  FilterFieldConfig,
  NestedFilterValue,
} from "./filter-types";

interface NestedFilterInputProps {
  fieldConfig: FilterFieldConfig;
  value: NestedFilterValue | null | undefined;
  onChange: (value: NestedFilterValue) => void;
  groupId: string;
}

/**
 * Nested Filter Input for Materials and Facilities
 *
 * Structure:
 * 1. Primary Selection (multi-select of materials/facilities)
 * 2. [Optional] WHERE conditions button
 * 3. [Expandable] Nested filter rows for additional constraints
 *
 * Example: "Products with Cotton WHERE percentage > 80%"
 * Example: "Products made in Factory A WHERE step type = Manufacturing"
 */
export function NestedFilterInput({
  fieldConfig,
  value,
  onChange,
  groupId,
}: NestedFilterInputProps) {
  const [showWhere, setShowWhere] = React.useState(false);

  const nestedConfig = fieldConfig.nested;
  if (!nestedConfig) {
    return (
      <div className="text-p text-tertiary">Invalid nested configuration</div>
    );
  }

  // Get available nested fields
  const nestedFieldConfigs = React.useMemo(() => {
    return nestedConfig.nestedFields
      .map((fieldId) => getFieldConfig(fieldId))
      .filter((config): config is FilterFieldConfig => config !== undefined);
  }, [nestedConfig.nestedFields]);

  const primarySelection = value?.primarySelection ?? [];
  const whereConditions = value?.whereConditions ?? [];

  // Handle primary selection change
  const handlePrimaryChange = (newSelection: string | string[]) => {
    onChange({
      primarySelection: Array.isArray(newSelection)
        ? newSelection
        : [newSelection],
      whereConditions: value?.whereConditions,
    });
  };

  // Add new WHERE condition
  const handleAddCondition = () => {
    const newCondition: FilterCondition = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fieldId: nestedFieldConfigs[0]?.id ?? "",
      operator: nestedFieldConfigs[0]?.operators[0] ?? ("is" as any),
      value: null,
    };

    onChange({
      primarySelection: value?.primarySelection ?? [],
      whereConditions: [...whereConditions, newCondition],
    });

    setShowWhere(true);
  };

  // Update WHERE condition
  const handleUpdateCondition = (
    conditionId: string,
    updates: Partial<FilterCondition>,
  ) => {
    const updatedConditions = whereConditions.map((condition) =>
      condition.id === conditionId ? { ...condition, ...updates } : condition,
    );

    onChange({
      primarySelection: value?.primarySelection ?? [],
      whereConditions: updatedConditions,
    });
  };

  // Remove WHERE condition
  const handleRemoveCondition = (conditionId: string) => {
    const updatedConditions = whereConditions.filter(
      (condition) => condition.id !== conditionId,
    );

    onChange({
      primarySelection: value?.primarySelection ?? [],
      whereConditions: updatedConditions,
    });

    if (updatedConditions.length === 0) {
      setShowWhere(false);
    }
  };

  // Toggle WHERE section
  React.useEffect(() => {
    if (whereConditions.length > 0) {
      setShowWhere(true);
    }
  }, [whereConditions.length]);

  return (
    <div className="space-y-2">
      {/* Primary Selection */}
      <div>
        <MultiSelectInputWrapper
          fieldConfig={fieldConfig}
          value={primarySelection}
          onChange={handlePrimaryChange}
        />
      </div>

      {/* WHERE Conditions Section */}
      {whereConditions.length === 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddCondition}
          className="w-full text-secondary hover:text-primary"
          iconPosition="left"
          icon={<Icons.Plus className="h-4 w-4" />}
        >
          Add WHERE condition
        </Button>
      ) : (
        <div className="space-y-2">
          {/* WHERE Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWhere(!showWhere)}
              className="text-small font-medium text-secondary uppercase tracking-wide hover:bg-transparent p-0"
            >
              <Icons.ChevronRight
                className={cn(
                  "h-4 w-4 mr-1 transition-transform",
                  showWhere && "rotate-90",
                )}
              />
              Where ({whereConditions.length})
            </Button>
          </div>

          {/* WHERE Conditions (Collapsible) */}
          {showWhere && (
            <div className="space-y-2 pl-4 border-l-2 border-border">
              {whereConditions.map((condition) => (
                <FilterRow
                  key={condition.id}
                  groupId={groupId}
                  condition={condition}
                  onUpdate={(updates) =>
                    handleUpdateCondition(condition.id, updates)
                  }
                  onRemove={() => handleRemoveCondition(condition.id)}
                  availableFields={nestedFieldConfigs}
                  isNested={true}
                  showRemove={true}
                />
              ))}

              {/* Add Another WHERE Condition */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddCondition}
                className="w-full text-secondary hover:text-primary"
                iconPosition="left"
                icon={<Icons.Plus className="h-4 w-4" />}
              >
                And
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper component to render multi-select for primary selection
 *
 * This is extracted to handle the dynamic options loading
 */
function MultiSelectInputWrapper({
  fieldConfig,
  value,
  onChange,
}: {
  fieldConfig: FilterFieldConfig;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  // For now, render a simple input that matches the FilterValueInput pattern
  // The actual MultiSelect logic is in filter-value-input.tsx

  return (
    <div className="text-p text-secondary">
      <span className="font-medium">{fieldConfig.label}</span>
      <span className="text-tertiary ml-2 italic">
        (Multi-select implementation pending)
      </span>
    </div>
  );
}
