"use client";

import * as React from "react";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import type {
  FilterGroup as FilterGroupType,
  FilterCondition,
  FilterFieldConfig,
} from "./filter-types";
import { FilterRow } from "./filter-row";

interface FilterGroupProps {
  group: FilterGroupType;
  onAddCondition: () => void;
  onUpdateCondition: (conditionId: string, updates: Partial<FilterCondition>) => void;
  onRemoveCondition: (conditionId: string) => void;
  onRemoveGroup: () => void;
  availableFields?: FilterFieldConfig[];
  showGroupHeader?: boolean;
  isOnlyGroup?: boolean;
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
  showGroupHeader = true,
  isOnlyGroup = false,
}: FilterGroupProps) {
  const hasMultipleConditions = group.conditions.length > 1;

  return (
    <div className="space-y-2">
      {/* Group Header */}
      {showGroupHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-small font-medium text-secondary uppercase tracking-wide">
              {isOnlyGroup ? "Where" : "And Where"}
            </span>
            {hasMultipleConditions && (
              <span className="text-small text-tertiary italic">
                (Any of the following)
              </span>
            )}
          </div>
          {!isOnlyGroup && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveGroup}
              className="h-7 text-tertiary hover:text-destructive"
            >
              <Icons.X className="h-4 w-4 mr-1" />
              Remove group
            </Button>
          )}
        </div>
      )}

      {/* Filter Conditions */}
      <div className="space-y-2">
        {group.conditions.map((condition, index) => (
          <React.Fragment key={condition.id}>
            {/* OR Divider (between conditions) */}
            {index > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-small font-medium text-secondary uppercase tracking-wide">
                  Or
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {/* Filter Row */}
            <FilterRow
              groupId={group.id}
              condition={condition}
              onUpdate={(updates) => onUpdateCondition(condition.id, updates)}
              onRemove={() => onRemoveCondition(condition.id)}
              availableFields={availableFields}
              showRemove={group.conditions.length > 1}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Add OR Button */}
      <Button
        variant="subtle"
        size="sm"
        onClick={onAddCondition}
        className="w-full"
        iconPosition="left"
        icon={<Icons.Plus className="h-4 w-4" />}
      >
        Or
      </Button>
    </div>
  );
}

