"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePassportFormData, getCategoryKey } from "@/hooks/use-passport-form-data";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { toast } from "@v1/ui/sonner";
import * as React from "react";
import { createPortal } from "react-dom";
import type { TierTwoSizeOption } from "../select/size-select";

interface SizeRow {
  id: string; // Database ID for existing sizes, or temp ID for new sizes
  value: string;
  dbId?: string; // Original database ID (only for existing sizes)
  originalValue?: string; // Original name (only for existing sizes, to track edits)
  isNew: boolean; // True if this is a new size not yet in DB
}

export interface SizeSystemDefinition {
  categoryKey: string;
  categoryPath: string;
  sizes: Array<{ name: string; sortIndex: number }>;
}

interface SizeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillSize?: string | null;
  prefillCategory?: string | null;
  onSave: (definition: SizeSystemDefinition) => void;
}

function TierTwoCategorySelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const { tierTwoCategoryHierarchy } = usePassportFormData();
  const [open, setOpen] = React.useState(false);
  const [selectedCategoryPath, setSelectedCategoryPath] = React.useState<string | null>(value);
  const [navigationPath, setNavigationPath] = React.useState<string[]>([]); // ["Men's"] or empty

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Get tier-one categories (Men's, Women's)
  const tierOneCategories = React.useMemo(() => {
    return Object.keys(tierTwoCategoryHierarchy).sort();
  }, [tierTwoCategoryHierarchy]);

  // Get current view based on navigation
  const currentView = React.useMemo(() => {
    if (navigationPath.length === 0) {
      return { type: "tier-one" as const, categories: tierOneCategories };
    }
    // navigationPath.length === 1
    const tierOneKey = navigationPath[0];
    const tierTwoFullPaths = tierOneKey ? (tierTwoCategoryHierarchy[tierOneKey] || []) : [];
    return { type: "tier-two" as const, categories: tierTwoFullPaths };
  }, [navigationPath, tierOneCategories, tierTwoCategoryHierarchy]);

  const handleNavigateForward = (category: string) => {
    setNavigationPath([...navigationPath, category]);
  };

  const handleNavigateBack = () => {
    if (navigationPath.length > 0) {
      setNavigationPath(navigationPath.slice(0, -1));
    }
  };

  const handleSelect = (categoryPath: string) => {
    setSelectedCategoryPath(categoryPath);
    onChange(categoryPath);
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    
    // Delay reset until after popover close animation completes
    if (!newOpen) {
      setTimeout(() => {
        setNavigationPath([]);
      }, 200);
    }
  };

  // Get breadcrumb string for navigation bar
  const getBreadcrumbString = () => {
    return navigationPath.join(" / ");
  };

  React.useEffect(() => {
    setSelectedCategoryPath(value);
  }, [value]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-1.5 w-full">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-9"
            icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
          >
            <span className={cn(!selectedCategoryPath ? "text-tertiary" : "text-primary")}>
              {selectedCategoryPath || "Select category"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <div className="flex flex-col">
            {/* Navigation Bar for tier-two (page 2) */}
            {currentView.type === "tier-two" && navigationPath.length > 0 && (
              <div className="border-b border-border bg-background">
                <button
                  type="button"
                  onClick={handleNavigateBack}
                  className="w-full py-2 px-3 type-p text-primary focus:outline-none flex items-center hover:bg-accent transition-colors"
                >
                  <Icons.ChevronLeft className="h-4 w-4 mr-2 text-secondary" />
                  <span className="text-primary">{getBreadcrumbString()}</span>
                </button>
              </div>
            )}

            {/* Content Area */}
            <div className="max-h-48 overflow-y-auto">
              {currentView.type === "tier-one" && (
                // Page 1: Tier-one categories
                <>
                  {tierOneCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleNavigateForward(category)}
                      className="w-full px-3 py-2 type-p text-left transition-colors flex items-center justify-between hover:bg-accent text-primary"
                    >
                      <span>{category}</span>
                      <Icons.ChevronRight className="h-4 w-4 text-tertiary" />
                    </button>
                  ))}
                </>
              )}

              {currentView.type === "tier-two" && (
                // Page 2: Tier-two categories (final selection)
                <>
                  {currentView.categories.map((categoryPath) => {
                    const isSelected = selectedCategoryPath === categoryPath;
                    return (
                      <button
                        key={categoryPath}
                        type="button"
                        onClick={() => handleSelect(categoryPath)}
                        className={cn(
                          "w-full px-3 py-2 type-p text-left transition-colors flex items-center justify-between",
                          isSelected
                            ? "bg-accent-blue text-brand"
                            : "hover:bg-accent text-primary",
                        )}
                      >
                        <span>{categoryPath.split(" / ")[1]}</span>
                        {isSelected && (
                          <Icons.Check className="h-4 w-4 text-brand" />
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DraggableSizeRow({
  row,
  onUpdate,
  onDelete,
}: {
  row: SizeRow;
  onUpdate: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab h-9 w-9 flex items-center justify-center border-y border-l border-border bg-background active:cursor-grabbing text-tertiary hover:text-secondary transition-colors flex-shrink-0"
      >
        <Icons.GripVertical className="h-4 w-4" />
      </div>
      <div className="relative flex-1 group/field">
        <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
          <Input
            value={row.value}
            onChange={(e) => onUpdate(row.id, e.target.value)}
            placeholder="Enter size"
            className="h-9"
            maxLength={50}
          />
        </div>
        <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
          <Button
            type="button"
            variant="outline"
            onClick={() => onDelete(row.id)}
            className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
          >
            <Icons.X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SizeModal({
  open,
  onOpenChange,
  prefillSize,
  prefillCategory,
  onSave,
}: SizeModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { categories, sizeOptions } = usePassportFormData();

  const [category, setCategory] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<SizeRow[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [currentPrefillSize, setCurrentPrefillSize] = React.useState<string | null>(null);

  // Set mounted flag to prevent SSR/hydration issues
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // API mutations for CRUD operations
  const createSizeMutation = useMutation(
    trpc.brand.sizes.create.mutationOptions(),
  );
  const updateSizeMutation = useMutation(
    trpc.brand.sizes.update.mutationOptions(),
  );
  const deleteSizeMutation = useMutation(
    trpc.brand.sizes.delete.mutationOptions(),
  );

  // Helper to find category ID from category path (e.g., "Men's / Tops")
  const findCategoryIdFromPath = React.useCallback((categoryPath: string): string | null => {
    if (!categoryPath) return null;
    
    const parts = categoryPath.split(" / ");
    if (parts.length !== 2) return null;
    
    const [tierOneName, tierTwoName] = parts;
    
    // Find the tier-two category by matching both parent and child names
    for (const cat of categories) {
      if (cat.name === tierTwoName && cat.parent_id) {
        // Check if parent matches
        const parent = categories.find(c => c.id === cat.parent_id);
        if (parent?.name === tierOneName) {
          return cat.id;
        }
      }
    }
    
    return null;
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const activeRow = React.useMemo(
    () => rows.find((row) => row.id === activeId),
    [activeId, rows],
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over?.id) {
      setRows((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);

        const next = [...items];
        const [removed] = next.splice(oldIndex, 1);
        if (removed) {
          next.splice(newIndex, 0, removed);
        }
        return next;
      });
    }
    setActiveId(null);
  }, []);

  const updateRow = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value } : row)),
    );
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const addRow = () => {
    const newRow: SizeRow = {
      id: `new-${Date.now()}`,
      value: "",
      isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleSave = async () => {
    if (!category) return;

    // Filter out empty rows
    const validRows = rows.filter((r) => r.value.trim());
    if (validRows.length === 0) {
      toast.error("Please add at least one size");
      return;
    }

    const categoryId = findCategoryIdFromPath(category);
    if (!categoryId) {
      toast.error("Invalid category selected");
      return;
    }

    const categoryKey = getCategoryKey(category);
    if (!categoryKey) {
      toast.error("Invalid category selected");
      return;
    }

    // Validate: Check for duplicate names (case-insensitive)
    const nameMap = new Map<string, number>();
    for (const row of validRows) {
      const lowerName = row.value.toLowerCase();
      const count = nameMap.get(lowerName) || 0;
      nameMap.set(lowerName, count + 1);
    }
    const duplicates = Array.from(nameMap.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name);
    
    if (duplicates.length > 0) {
      toast.error(`Duplicate size names: ${duplicates.join(", ")}`);
      return;
    }

    try {
      // Get original sizes from DB for comparison
      const originalSizes = sizeOptions
        .filter(s => s.categoryPath === category && s.id)
        .reduce((acc, s) => {
          acc.set(s.id!, s);
          return acc;
        }, new Map<string, typeof sizeOptions[0]>());
      
      // Get valid DB IDs for safety checks
      const validDbIds = new Set(Array.from(originalSizes.keys()));

      // Determine what operations to perform
      const toCreate: Array<{ name: string; sortIndex: number }> = [];
      const toUpdate: Array<{ id: string; name: string; sortIndex: number }> = [];
      const toDelete: string[] = [];

      // Check each current row
      validRows.forEach((row, index) => {
        if (row.isNew) {
          // New size to create
          toCreate.push({
            name: row.value,
            sortIndex: index,
          });
        } else if (row.dbId) {
          // Existing size - check if modified
          const original = originalSizes.get(row.dbId);
          if (original) {
            const nameChanged = row.value !== original.name;
            const orderChanged = index !== original.sortIndex;
            
            if (nameChanged || orderChanged) {
              toUpdate.push({
                id: row.dbId,
                name: row.value,
                sortIndex: index,
              });
            }
            
            // Mark as still present
            originalSizes.delete(row.dbId);
          }
        }
      });

      // Any remaining original sizes were deleted
      toDelete.push(...Array.from(originalSizes.keys()));

      // Execute operations with per-operation error handling
      const operationResults: Array<{ type: string; success: boolean; error?: Error }> = [];
      
      // Helper to execute operation with error handling and response validation
      const executeOperation = async <T,>(
        operation: () => Promise<T>,
        type: string,
        validateResponse?: (result: T) => boolean,
      ): Promise<T | null> => {
        try {
          const result = await operation();
          
          // Validate response if validator provided
          if (validateResponse && !validateResponse(result)) {
            throw new Error(`Invalid response returned from ${type} operation`);
          }
          
          operationResults.push({ type, success: true });
          return result;
        } catch (error) {
          operationResults.push({
            type,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          return null;
        }
      };

      // Collect all operations
      const operations: Array<() => Promise<any>> = [];

      // Deletions - only delete if ID exists in current DB state
      for (const id of toDelete) {
        if (validDbIds.has(id)) {
          operations.push(() =>
            executeOperation(
              () => deleteSizeMutation.mutateAsync({ id }),
              `delete-${id}`,
            ),
          );
        }
      }

      // Updates - only update if ID exists in current DB state
      for (const size of toUpdate) {
        if (validDbIds.has(size.id)) {
          operations.push(() =>
            executeOperation(
              () =>
                updateSizeMutation.mutateAsync({
                  id: size.id,
                  name: size.name,
                  category_id: categoryId,
                  sort_index: size.sortIndex,
                }),
              `update-${size.id}`,
              (result: any) => {
                // Validate response has expected structure
                return result?.data?.id !== undefined;
              },
            ),
          );
        }
      }

      // Creations
      for (const size of toCreate) {
        operations.push(() =>
          executeOperation(
            () =>
              createSizeMutation.mutateAsync({
                name: size.name,
                category_id: categoryId,
                sort_index: size.sortIndex,
              }),
            `create-${size.name}`,
            (result: any) => {
              // Validate response has expected structure (similar to showcase-brand-sheet)
              return result?.data?.id !== undefined;
            },
          ),
        );
      }

      // Execute all operations with toast.loading pattern
      if (operations.length > 0) {
        await toast.loading(
          "Saving sizes...",
          (async () => {
            await Promise.all(operations.map((op) => op()));
            
            // Check for any failed operations after all operations complete
            const failedOperations = operationResults.filter((r) => !r.success);
            if (failedOperations.length > 0) {
              const errorMessages = failedOperations
                .map((r) => r.error?.message || "Unknown error")
                .join(", ");
              throw new Error(
                `Failed to save ${failedOperations.length} operation(s): ${errorMessages}`,
              );
            }
            
            return { success: true };
          })(),
          {
            delay: 200,
            successMessage: "Size system successfully updated",
          },
        );
      }

      // Response validation is handled in executeOperation for create/update operations

      // Invalidate to trigger background refetch
      queryClient.invalidateQueries({
        queryKey: trpc.composite.passportFormReferences.queryKey(),
      });

      // Build definition with all sizes
      const definition: SizeSystemDefinition = {
        categoryKey,
        categoryPath: category,
        sizes: validRows.map((r, index) => ({
          name: r.value,
          sortIndex: index,
        })),
      };

      // Close modal first
      onOpenChange(false);

      // Call parent callback
      onSave(definition);
    } catch (error) {
      console.error("Failed to save sizes:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save sizes. Please try again.",
      );
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Compute loading state from mutations
  const isCreating = 
    createSizeMutation.isPending || 
    updateSizeMutation.isPending || 
    deleteSizeMutation.isPending;

  // Initialize when modal opens
  React.useEffect(() => {
    if (open) {
      // Pre-fill category if provided from SizeSelect navigation
      setCategory(prefillCategory || null);
      setCurrentPrefillSize(prefillSize || null);
      setRows([]);
      setActiveId(null);
    } else {
      // Clean up state when modal closes (delayed to avoid flash during animation)
      const timer = setTimeout(() => {
        setCategory(null);
        setRows([]);
        setActiveId(null);
        setCurrentPrefillSize(null);
      }, 350); // Match dialog close animation duration
      return () => clearTimeout(timer);
    }
  }, [open, prefillCategory, prefillSize]);

  // Initialize rows when category is selected or changes
  React.useEffect(() => {
    if (!open || !category || category === "Select category") {
      return;
    }

    const newRows: SizeRow[] = [];

    // Get existing sizes for this category from the database
    const categoryKey = getCategoryKey(category);
    const existingSizes = categoryKey 
      ? sizeOptions
          .filter(s => s.categoryPath === category)
          .sort((a, b) => a.sortIndex - b.sortIndex)
      : [];

    // Add existing sizes first
    for (const size of existingSizes) {
      newRows.push({
        id: size.id || `temp-${Date.now()}-${Math.random()}`,
        value: size.name,
        dbId: size.id,
        originalValue: size.name,
        isNew: false,
      });
    }

    // If prefillSize is provided for this specific category and not already in the list, add it at the top
    // Only use prefillSize if it matches the current category context
    if (currentPrefillSize?.trim() && category === prefillCategory) {
      const alreadyExists = existingSizes.some(
        s => s.name.toLowerCase() === currentPrefillSize.toLowerCase()
      );
      
      if (!alreadyExists) {
        newRows.unshift({
          id: `new-${Date.now()}`,
          value: currentPrefillSize,
          isNew: true,
        });
      }
    }

    setRows(newRows);
  }, [category, open, currentPrefillSize, prefillCategory, sizeOptions]);

  // Don't render until client-side to avoid SSR issues
  if (!mounted) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Manage sizes</DialogTitle>
        </DialogHeader>

        <div className="px-6 flex flex-col gap-2 items-start">
          {/* Category Dropdown - Tier 2 only */}
          <TierTwoCategorySelect 
            value={category} 
            onChange={(newCategory) => {
              setCategory(newCategory);
              // Clear prefillSize when category changes
              setCurrentPrefillSize(null);
            }}
          />

          {/* Animated container for category-dependent content */}
          <div
            className={cn(
              "grid w-full transition-all duration-150 ease-in-out",
              category ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 w-full">
                {/* Info message */}
                <div className="w-full space-y-1.5">
                  <p className="type-small text-tertiary">
                    {rows.length > 0 
                      ? `Managing sizes for ${category}. Drag to reorder, edit names, click X to delete, or add more.`
                      : `No sizes found for ${category}. Click "Add size" below to create your size list.`}
                  </p>
                </div>

                {/* Draggable Size Rows */}
                <div className="flex flex-col gap-2 w-full mt-2 max-h-[320px] overflow-y-auto scrollbar-hide">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={rows.map((r) => r.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {rows.map((row) => (
                        <DraggableSizeRow
                          key={row.id}
                          row={row}
                          onUpdate={updateRow}
                          onDelete={deleteRow}
                        />
                      ))}
                    </SortableContext>
                    {typeof window !== "undefined" &&
                      createPortal(
                        <DragOverlay dropAnimation={null}>
                          {activeRow ? (
                            <div className="flex items-center shadow-lg opacity-95">
                              <div className="h-9 w-9 flex items-center justify-center border-y border-l border-border bg-background text-tertiary">
                                <Icons.GripVertical className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <Input
                                  value={activeRow.value}
                                  readOnly
                                  className="h-9 pointer-events-none"
                                />
                              </div>
                            </div>
                          ) : null}
                        </DragOverlay>,
                        document.body,
                      )}
                  </DndContext>
                </div>

                {/* Add Size Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addRow}
                  icon={<Icons.Plus className="h-4 w-4" />}
                  iconPosition="left"
                >
                  Add size
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-3">
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSave} disabled={!category || rows.length === 0 || isCreating}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
