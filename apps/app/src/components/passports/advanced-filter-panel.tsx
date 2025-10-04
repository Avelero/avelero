"use client";

import { useFilterMetadata } from "@/hooks/use-filter-state";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@v1/ui/sheet";
import * as React from "react";
import { FilterGroup } from "./filter-group";
import type {
  FilterActions,
  FilterFieldConfig,
  FilterState,
} from "./filter-types";

interface AdvancedFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterState: FilterState;
  filterActions: FilterActions;
  availableFields?: FilterFieldConfig[];
}

/**
 * Advanced Filter Panel Component
 *
 * Renders as a Sheet sliding in from the right (~33% screen width).
 * Contains all the filter groups with full AND/OR logic support.
 *
 * Structure:
 * - Header (title, description, close button)
 * - Scrollable Area (filter groups)
 * - Footer (Clear All, Apply buttons)
 */
export function AdvancedFilterPanel({
  open,
  onOpenChange,
  filterState,
  filterActions,
  availableFields,
}: AdvancedFilterPanelProps) {
  const metadata = useFilterMetadata(filterState);

  // Handle apply - closes the panel
  const handleApply = () => {
    onOpenChange(false);
  };

  // Handle cancel - closes the panel without applying
  const handleCancel = () => {
    onOpenChange(false);
  };

  // Initialize with empty group if no groups exist
  React.useEffect(() => {
    if (open && filterState.groups.length === 0) {
      filterActions.addGroup();
    }
  }, [open, filterState.groups.length, filterActions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-h6 text-primary">
            Advanced filters
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 pt-6">
          <div className="space-y-6">
            {filterState.groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icons.Filter className="h-12 w-12 text-tertiary mb-4" />
                <p className="text-p text-secondary mb-2">No filters yet</p>
                <p className="text-small text-tertiary mb-4">
                  Add your first filter condition to get started
                </p>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => filterActions.addGroup()}
                  iconPosition="left"
                  icon={<Icons.Plus className="h-4 w-4" />}
                >
                  Add Filter
                </Button>
              </div>
            ) : (
              <>
                {/* Filter Groups */}
                {filterState.groups.map((group, index) => (
                  <React.Fragment key={group.id}>
                    {/* AND Separator (between groups) */}
                    {index > 0 && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-small font-medium text-brand uppercase tracking-wide">
                          And
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}

                    {/* Filter Group */}
                    <FilterGroup
                      group={group}
                      onAddCondition={() =>
                        filterActions.addCondition(group.id)
                      }
                      onUpdateCondition={(conditionId, updates) =>
                        filterActions.updateCondition(
                          group.id,
                          conditionId,
                          updates,
                        )
                      }
                      onRemoveCondition={(conditionId) =>
                        filterActions.removeCondition(group.id, conditionId)
                      }
                      onRemoveGroup={() => filterActions.removeGroup(group.id)}
                      availableFields={availableFields}
                      showGroupHeader={true}
                      isOnlyGroup={filterState.groups.length === 1}
                    />
                  </React.Fragment>
                ))}

                {/* Add Group Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => filterActions.addGroup()}
                  className="w-full"
                  iconPosition="left"
                  icon={<Icons.Plus className="h-4 w-4" />}
                >
                  Add Filter Group
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#F7F7FF]">
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="default"
              size="default"
              onClick={handleCancel}
              className="w-[70px]"
            >
              Cancel
            </Button>
            <Button
              variant="brand"
              size="default"
              onClick={handleApply}
              className="w-[70px]"
            >
              Apply
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
