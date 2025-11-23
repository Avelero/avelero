"use client";

import { useFilterMetadata } from "@/hooks/use-filter-state";
import {
  getAdvancedFilterGroups,
  hasQuickFilters,
} from "@/utils/filter-converter";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import {
  Sheet,
  SheetBreadcrumbHeader,
  SheetContent,
  SheetFooter,
} from "@v1/ui/sheet";
import * as React from "react";
import { FilterGroup, FilterRow } from "../filter-components";
import type {
  FilterActions,
  FilterFieldConfig,
  FilterState,
} from "../passports/filter-types";

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
  // Local state for editing - only syncs back on Apply
  const [localState, setLocalState] = React.useState<FilterState>({ groups: [] });

  // Sync local state when panel opens
  // If quick filters are active, start empty (advanced filters will overwrite)
  // If advanced filters are active, show those existing filters
  React.useEffect(() => {
    if (open) {
      if (hasQuickFilters(filterState)) {
        // Quick filters are active - start with empty advanced filters
        setLocalState({ groups: [] });
      } else {
        // Advanced filters are active (or no filters) - show existing advanced filters
        const advancedGroups = getAdvancedFilterGroups(filterState);
        setLocalState({ groups: advancedGroups });
      }
    }
  }, [open, filterState]);

  // Initialize with empty group if needed (only if no groups exist)
  React.useEffect(() => {
    if (open && localState.groups.length === 0) {
      setLocalState((prev) => ({
        ...prev,
        groups: [
          {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            conditions: [
              {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                fieldId: "",
                operator: "is" as any,
                value: null,
              },
            ],
            asGroup: false,
            source: "advanced", // Mark as advanced filter
          },
        ],
      }));
    }
  }, [open, localState.groups.length]);

  const metadata = useFilterMetadata(localState);

  // Local actions that only update local state
  const localActions = React.useMemo(
    () => ({
      addGroup: () => {
        setLocalState((prev) => ({
          ...prev,
          groups: [
            ...prev.groups,
            {
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              conditions: [
                {
                  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  fieldId: "",
                  operator: "is" as any,
                  value: null,
                },
              ],
              asGroup: false,
              source: "advanced", // Mark as advanced filter
            },
          ],
        }));
      },
      removeGroup: (groupId: string) => {
        setLocalState((prev) => ({
          ...prev,
          groups: prev.groups.filter((g) => g.id !== groupId),
        }));
      },
      updateGroup: (groupId: string, updates: any) => {
        setLocalState((prev) => ({
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === groupId ? { ...g, ...updates } : g,
          ),
        }));
      },
      addCondition: (groupId: string, initial?: any) => {
        setLocalState((prev) => ({
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  conditions: [
                    ...g.conditions,
                    {
                      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      fieldId: "",
                      operator: "is" as any,
                      value: null,
                      ...(initial ?? {}),
                    },
                  ],
                }
              : g,
          ),
        }));
      },
      updateCondition: (groupId: string, conditionId: string, updates: any) => {
        setLocalState((prev) => ({
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  conditions: g.conditions.map((c) =>
                    c.id === conditionId ? { ...c, ...updates } : c,
                  ),
                }
              : g,
          ),
        }));
      },
      removeCondition: (groupId: string, conditionId: string) => {
        setLocalState((prev) => {
          const updatedGroups = prev.groups
            .map((g) => {
              if (g.id !== groupId) return g;
              const updatedConditions = g.conditions.filter(
                (c) => c.id !== conditionId,
              );
              if (updatedConditions.length === 0) return null;
              return { ...g, conditions: updatedConditions };
            })
            .filter((g): g is any => g !== null);
          return { ...prev, groups: updatedGroups };
        });
      },
      clearAll: () => {
        setLocalState((prev) => ({ ...prev, groups: [] }));
      },
      setGroups: (groups: any[]) => {
        setLocalState((prev) => ({ ...prev, groups }));
      },
    }),
    [],
  );

  // Handle apply - completely replace FilterState with advanced filter groups
  // This overwrites any quick filters that might be active
  const handleApply = () => {
    // Mark all groups as advanced filters and replace entire FilterState
    const advancedGroups = localState.groups.map((group) => ({
      ...group,
      source: "advanced" as const,
    }));
    filterActions.setGroups(advancedGroups);
    onOpenChange(false);
  };

  // Handle cancel - discard changes and close
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
        hideDefaultClose
      >
        {/* Header */}
        <SheetBreadcrumbHeader
          pages={["Advanced filters"]}
          currentPageIndex={0}
          onClose={() => onOpenChange(false)}
        />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <div className="flex flex-col items-start gap-4">
            {localState.groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icons.Filter className="h-12 w-12 text-tertiary mb-4" />
                <p className="type-p text-secondary mb-2">No filters yet</p>
                <p className="type-small text-tertiary mb-4">
                  Add your first filter condition to get started
                </p>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => localActions.addGroup()}
                  iconPosition="left"
                  icon={<Icons.Plus className="h-4 w-4" />}
                >
                  Add Filter
                </Button>
              </div>
            ) : (
              <>
                {localState.groups.map((group, index) => {
                  const isGroupUI =
                    group.asGroup || group.conditions.length > 1;
                  const firstCondition = group.conditions[0]!; // groups always have at least 1 condition
                  return (
                    <React.Fragment key={group.id}>
                      {index > 0 && (
                        <div className="flex items-center gap-3 w-full">
                          <div className="h-px flex-1 bg-border" />
                          <span className="type-small font-medium text-secondary uppercase tracking-wide">
                            and
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )}

                      {isGroupUI ? (
                        <FilterGroup
                          group={group}
                          onAddCondition={() =>
                            localActions.addCondition(group.id)
                          }
                          onUpdateCondition={(conditionId, updates) =>
                            localActions.updateCondition(
                              group.id,
                              conditionId,
                              updates,
                            )
                          }
                          onRemoveCondition={(conditionId) =>
                            localActions.removeCondition(group.id, conditionId)
                          }
                          onRemoveGroup={() =>
                            localActions.removeGroup(group.id)
                          }
                          availableFields={availableFields}
                        />
                      ) : (
                        <FilterRow
                          groupId={group.id}
                          condition={firstCondition}
                          onUpdate={(updates) =>
                            localActions.updateCondition(
                              group.id,
                              firstCondition.id,
                              updates,
                            )
                          }
                          onDelete={() =>
                            localActions.removeCondition(
                              group.id,
                              firstCondition.id,
                            )
                          }
                          onConvertToGroup={() =>
                            localActions.updateGroup(group.id, {
                              asGroup: true,
                            })
                          }
                          availableFields={availableFields}
                        />
                      )}
                    </React.Fragment>
                  );
                })}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => localActions.addGroup()}
                >
                  <Icons.Plus className="h-4 w-4 mr-1" /> Create filter
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter>
          <Button
            variant="outline"
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
