"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DraggableSyntheticListeners,
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
import { productionStepNames } from "@v1/selections/production-steps";
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
import { createPortal } from "react-dom";
import {
  type OperatorData,
  OperatorSheet,
} from "../../../sheets/operator-sheet";

interface JourneyStep {
  id: string;
  step: string;
  operators: Array<{ id: string; name: string }>; // Multiple operators per step
  position: number;
}

// Use production steps from selections package
const STEP_OPTIONS = productionStepNames;

const StepDropdown = ({
  step,
  onStepChange,
  isDragging,
  dragAttributes,
  dragListeners,
}: {
  step: string;
  onStepChange: (step: string) => void;
  isDragging: boolean;
  dragAttributes: React.HTMLAttributes<HTMLElement>;
  dragListeners: DraggableSyntheticListeners | undefined;
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSelect = (selectedStep: string) => {
    onStepChange(selectedStep);
    setDropdownOpen(false);
    setSearchQuery("");
  };

  const handleCreate = () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery && !STEP_OPTIONS.includes(trimmedQuery)) {
      onStepChange(trimmedQuery);
      setSearchQuery("");
      setDropdownOpen(false);
    }
  };

  const filteredOptions = STEP_OPTIONS.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex items-stretch w-full h-full">
      <div className="w-10 h-10 flex items-center justify-center">
        <div
          {...dragAttributes}
          {...dragListeners}
          role="button"
          aria-label="Drag to reorder journey step"
          tabIndex={0}
          className="cursor-grab active:cursor-grabbing text-tertiary hover:text-secondary transition-colors flex-shrink-0 w-10 h-10 flex items-center justify-center"
        >
          <Icons.GripVertical className="h-4 w-4" />
        </div>
      </div>
      <Popover
        open={dropdownOpen && !isDragging}
        onOpenChange={setDropdownOpen}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => {
              if (!isDragging) setDropdownOpen(true);
            }}
            className={cn(
              "group w-full h-full flex-1 pr-2 py-[9.5px] flex items-start cursor-pointer transition-all text-left",
            )}
          >
            <div
              className={cn(
                "border-b border-border type-p transition-colors",
                step
                  ? "text-primary group-hover:text-secondary group-hover:border-secondary group-data-[state=open]:border-secondary group-data-[state=open]:text-secondary"
                  : "text-tertiary group-hover:text-secondary group-hover:border-secondary group-data-[state=open]:border-secondary group-data-[state=open]:text-secondary",
              )}
            >
              {step || "Select step"}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px]"
          align="start"
          alignOffset={-40}
          sideOffset={4}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const isSelected = step === option;
                    return (
                      <CommandItem
                        key={option}
                        value={option}
                        onSelect={() => handleSelect(option)}
                        className="justify-between"
                      >
                        <span className="type-p">{option}</span>
                        {isSelected && (
                          <Icons.Check className="h-4 w-4 text-brand" />
                        )}
                      </CommandItem>
                    );
                  })
                ) : searchQuery.trim() ? (
                  <CommandItem
                    value={searchQuery.trim()}
                    onSelect={handleCreate}
                  >
                    <div className="flex items-center">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary px-1">
                        Create &quot;{searchQuery.trim()}&quot;
                      </span>
                    </div>
                  </CommandItem>
                ) : (
                  <CommandEmpty>Start typing to create...</CommandEmpty>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const OperatorLabel = ({
  operator,
  onRemove,
}: {
  operator: { id: string; name: string };
  onRemove: () => void;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className="relative flex items-center justify-center px-2 h-6 border border-border rounded-full bg-background box-border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <p className="type-small leading-none text-primary">{operator.name}</p>
      {isHovered && (
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center">
          <div className="w-3 h-3 bg-gradient-to-r from-transparent to-background" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-4 h-4 flex rounded-r-full rounded-l-md items-center justify-center bg-background text-tertiary hover:text-destructive transition-colors"
          >
            <Icons.X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

const OperatorCell = ({
  operators,
  onOperatorsChange,
  onDelete,
  availableOperators,
  onOperatorJustCreated,
}: {
  operators: Array<{ id: string; name: string }>;
  onOperatorsChange: (operators: Array<{ id: string; name: string }>) => void;
  onDelete: () => void;
  availableOperators: Array<{ id: string; name: string }>;
  onOperatorJustCreated?: (operatorId: string, operatorName: string) => void;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [operatorSheetOpen, setOperatorSheetOpen] = React.useState(false);
  const [newOperatorName, setNewOperatorName] = React.useState("");

  const selectedIds = React.useMemo(
    () => new Set(operators.map((op) => op.id)),
    [operators],
  );

  const handleToggleOperator = (selectedOperator: {
    id: string;
    name: string;
  }) => {
    if (selectedIds.has(selectedOperator.id)) {
      // Remove operator
      onOperatorsChange(
        operators.filter((op) => op.id !== selectedOperator.id),
      );
    } else {
      // Add operator
      onOperatorsChange([...operators, selectedOperator]);
    }
    setSearchQuery("");
    // Keep popover open for multi-select
  };

  const handleRemoveOperator = (operatorId: string) => {
    onOperatorsChange(operators.filter((op) => op.id !== operatorId));
  };

  const handleCreate = () => {
    const trimmedQuery = searchQuery.trim();
    const operatorNames = availableOperators.map((op) => op.name);
    if (trimmedQuery && !operatorNames.includes(trimmedQuery)) {
      // Open operator sheet with the searched name
      setNewOperatorName(trimmedQuery);
      setOperatorSheetOpen(true);
      setSearchQuery("");
      setDropdownOpen(false);
    }
  };

  const handleOperatorCreated = (createdOperator: OperatorData) => {
    // Notify parent about the just-created operator (for race condition handling)
    onOperatorJustCreated?.(createdOperator.id, createdOperator.name);
    // Add the newly created operator to selection
    onOperatorsChange([
      ...operators,
      { id: createdOperator.id, name: createdOperator.name },
    ]);
    setNewOperatorName("");
  };

  const handleOperatorSheetClose = (open: boolean) => {
    setOperatorSheetOpen(open);
    if (!open) {
      setNewOperatorName("");
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const filteredOperators = React.useMemo(() => {
    if (!searchQuery) return availableOperators;
    const normalized = searchQuery.toLowerCase();
    return availableOperators.filter((op) =>
      op.name.toLowerCase().includes(normalized),
    );
  }, [availableOperators, searchQuery]);

  const showCreateOption =
    !!searchQuery.trim() &&
    !availableOperators.some(
      (op) => op.name.toLowerCase() === searchQuery.trim().toLowerCase(),
    );

  return (
    <>
      <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <PopoverTrigger asChild>
          <div
            className="group flex items-center justify-between w-full min-h-[40px] px-4 py-[5px]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            role="button"
            tabIndex={0}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {operators.map((op) => (
                <OperatorLabel
                  key={op.id}
                  operator={op}
                  onRemove={() => handleRemoveOperator(op.id)}
                />
              ))}
              <span
                className={cn(
                  "border-b border-border type-p transition-colors cursor-pointer",
                  "text-tertiary group-hover:text-secondary group-hover:border-secondary group-data-[state=open]:border-secondary group-data-[state=open]:text-secondary",
                )}
              >
                Select operator
              </span>
            </div>

            <div
              className="w-6 flex justify-center ml-2 flex-shrink-0"
              onClick={handleMenuClick}
            >
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "p-1 hover:bg-accent data-[state=open]:bg-accent data-[state=open]:opacity-100 rounded transition-colors",
                      isHovered ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <Icons.EllipsisVertical className="h-4 w-4 text-tertiary" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={4}
                  className="min-w-[120px]"
                >
                  <DropdownMenuItem
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <div className="flex items-center">
                      <Icons.X className="h-4 w-4" />
                      <span className="px-1">Delete</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px]"
          align="start"
          sideOffset={4}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filteredOperators.length > 0 ? (
                  filteredOperators.map((op) => {
                    const isSelected = selectedIds.has(op.id);
                    return (
                      <CommandItem
                        key={op.id}
                        value={op.name}
                        onSelect={() => handleToggleOperator(op)}
                        className="justify-between"
                      >
                        <span className="type-p">{op.name}</span>
                        {isSelected && (
                          <Icons.Check className="h-4 w-4 text-brand" />
                        )}
                      </CommandItem>
                    );
                  })
                ) : showCreateOption ? (
                  <CommandItem
                    value={searchQuery.trim()}
                    onSelect={handleCreate}
                  >
                    <div className="flex items-center">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary px-1">
                        Create &quot;{searchQuery.trim()}&quot;
                      </span>
                    </div>
                  </CommandItem>
                ) : (
                  <CommandEmpty>Start typing to create...</CommandEmpty>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <OperatorSheet
        open={operatorSheetOpen}
        onOpenChange={handleOperatorSheetClose}
        initialName={newOperatorName}
        onOperatorCreated={handleOperatorCreated}
      />
    </>
  );
};

function DraggableJourneyRow({
  journeyStep,
  onStepChange,
  onOperatorsChange,
  onDelete,
  availableOperators,
  onOperatorJustCreated,
}: {
  journeyStep: JourneyStep;
  onStepChange: (step: string) => void;
  onOperatorsChange: (operators: Array<{ id: string; name: string }>) => void;
  onDelete: () => void;
  availableOperators: Array<{ id: string; name: string }>;
  onOperatorJustCreated?: (operatorId: string, operatorName: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: journeyStep.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[180px_1fr] bg-background"
    >
      {/* Step Column */}
      <div className="border-r border-b border-border">
        <StepDropdown
          step={journeyStep.step}
          onStepChange={onStepChange}
          isDragging={isDragging}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      </div>

      {/* Operator Column */}
      <div className="border-b border-border">
        <OperatorCell
          operators={journeyStep.operators}
          onOperatorsChange={onOperatorsChange}
          onDelete={onDelete}
          availableOperators={availableOperators}
          onOperatorJustCreated={onOperatorJustCreated}
        />
      </div>
    </div>
  );
}

interface JourneySectionProps {
  journeySteps: Array<{
    stepType: string;
    operatorIds: string[]; // Multiple operators per step
    sortIndex: number;
  }>;
  setJourneySteps: (
    value: Array<{
      stepType: string;
      operatorIds: string[]; // Multiple operators per step
      sortIndex: number;
    }>,
  ) => void;
}

export function JourneySection({
  journeySteps: parentSteps,
  setJourneySteps: setParentSteps,
}: JourneySectionProps) {
  const { operators } = useBrandCatalog();
  // Local display state for drag-and-drop (with multiple operators per step)
  const [displaySteps, setDisplaySteps] = React.useState<JourneyStep[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const stepIdMapRef = React.useRef<Map<string, string>>(new Map());
  const justCreatedTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Track operators that were just created to preserve them during sync
  const [justCreatedOperator, setJustCreatedOperator] = React.useState<{
    id: string;
    name: string;
    forStepId: string;
  } | null>(null);

  // Map operators (facilities) to the format expected by dropdowns
  const availableOperators = React.useMemo(
    () =>
      operators.map((op) => ({
        id: op.id,
        name: op.display_name,
      })),
    [operators],
  );

  // Sync parent steps to display steps, preserving incomplete local steps
  React.useEffect(() => {
    const enriched = parentSteps
      .map((ps) => {
        // Map all operator IDs to operator objects
        const stepOperators = (ps.operatorIds || [])
          .map((opId) => {
            const opData = availableOperators.find((op) => op.id === opId);
            return opData ? { id: opData.id, name: opData.name } : null;
          })
          .filter((op): op is { id: string; name: string } => op !== null);

        // Stable ID based on step type + sortIndex; generate once
        const key = `${ps.stepType ?? "unknown"}|${ps.sortIndex}`;
        if (!stepIdMapRef.current.has(key)) {
          const generatedId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `step-${Math.random().toString(16).slice(2)}`;
          stepIdMapRef.current.set(key, generatedId);
        }
        const stableId = stepIdMapRef.current.get(key) as string;

        return {
          id: stableId,
          step: ps.stepType,
          operators: stepOperators,
          position: ps.sortIndex,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    // Preserve any incomplete local steps (steps that don't have a step type)
    setDisplaySteps((prev) => {
      const incompleteSteps = prev.filter((localStep) => !localStep.step);

      // Check if we have a just-created operator that needs to be preserved
      if (justCreatedOperator) {
        const targetStep = prev.find(
          (s) => s.id === justCreatedOperator.forStepId,
        );
        if (targetStep) {
          const alreadyHasOperator = targetStep.operators.some(
            (op) => op.id === justCreatedOperator.id,
          );
          if (!alreadyHasOperator) {
            // Find matching enriched step or incomplete step and add the operator
            const enrichedIndex = enriched.findIndex(
              (s) => s.id === justCreatedOperator.forStepId,
            );
            const enrichedStep = enriched[enrichedIndex];
            if (enrichedIndex >= 0 && enrichedStep) {
              enriched[enrichedIndex] = {
                ...enrichedStep,
                operators: [
                  ...enrichedStep.operators,
                  {
                    id: justCreatedOperator.id,
                    name: justCreatedOperator.name,
                  },
                ],
              };
            } else {
              const incompleteIndex = incompleteSteps.findIndex(
                (s) => s.id === justCreatedOperator.forStepId,
              );
              const incompleteStep = incompleteSteps[incompleteIndex];
              if (incompleteIndex >= 0 && incompleteStep) {
                incompleteSteps[incompleteIndex] = {
                  ...incompleteStep,
                  operators: [
                    ...incompleteStep.operators,
                    {
                      id: justCreatedOperator.id,
                      name: justCreatedOperator.name,
                    },
                  ],
                };
              }
            }
          }
        }
      }

      return [...enriched, ...incompleteSteps];
    });
  }, [parentSteps, availableOperators, justCreatedOperator]);

  // Helper to sync display steps back to parent
  const syncToParent = React.useCallback(
    (steps: JourneyStep[]) => {
      const parentSteps = steps
        .filter((s) => s.step) // Only include steps with a step type
        .map((s, index) => ({
          stepType: s.step,
          operatorIds: s.operators.map((op) => op.id),
          sortIndex: index,
        }));
      setParentSteps(parentSteps);
    },
    [setParentSteps],
  );

  // Debounce syncing to parent to avoid rerendering the whole form on every keystroke
  React.useEffect(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      syncToParent(displaySteps);
    }, 150);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (justCreatedTimeoutRef.current) {
        clearTimeout(justCreatedTimeoutRef.current);
      }
    };
  }, [displaySteps, syncToParent]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const activeStep = React.useMemo(
    () => displaySteps.find((step) => step.id === activeId),
    [activeId, displaySteps],
  );

  const updateJourneyStep = (
    id: string,
    updates: Partial<Omit<JourneyStep, "id" | "position">>,
  ) => {
    setDisplaySteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, ...updates } : step)),
    );
  };

  const handleOperatorsChange = (
    stepId: string,
    newOperators: Array<{ id: string; name: string }>,
  ) => {
    const updatedSteps = displaySteps.map((step) =>
      step.id === stepId ? { ...step, operators: newOperators } : step,
    );
    setDisplaySteps(updatedSteps);

    // Immediately sync to parent to prevent race condition
    const parentSteps = updatedSteps
      .filter((s) => s.step)
      .map((s, index) => ({
        stepType: s.step,
        operatorIds: s.operators.map((op) => op.id),
        sortIndex: index,
      }));
    setParentSteps(parentSteps);
  };

  const handleOperatorJustCreated = (
    stepId: string,
    operatorId: string,
    operatorName: string,
  ) => {
    // Track the just-created operator to preserve it during sync race conditions
    setJustCreatedOperator({
      id: operatorId,
      name: operatorName,
      forStepId: stepId,
    });

    // Clear after a delay (once sync is stable)
    if (justCreatedTimeoutRef.current) {
      clearTimeout(justCreatedTimeoutRef.current);
    }
    justCreatedTimeoutRef.current = setTimeout(
      () => setJustCreatedOperator(null),
      500,
    );
  };

  const deleteJourneyStep = (id: string) => {
    setDisplaySteps((prev) => {
      const filteredSteps = prev.filter((step) => step.id !== id);
      return filteredSteps.map((step, index) => ({
        ...step,
        position: index + 1,
      }));
    });
  };

  const addJourneyStep = () => {
    const newStep: JourneyStep = {
      id: `step-${Date.now()}`,
      step: "",
      operators: [],
      position: displaySteps.length + 1,
    };
    setDisplaySteps((prev) => [...prev, newStep]);
    // Don't sync to parent yet (no step type)
  };

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Guard against dropping outside droppable area
      if (!over || active.id === over.id) {
        setActiveId(null);
        return;
      }

      const oldIndex = displaySteps.findIndex((i) => i.id === active.id);
      const newIndex = displaySteps.findIndex((i) => i.id === over.id);

      // If we can't find the indices, don't reorder
      if (oldIndex === -1 || newIndex === -1) {
        setActiveId(null);
        return;
      }

      const next = [...displaySteps];
      const [removed] = next.splice(oldIndex, 1);
      if (removed) {
        next.splice(newIndex, 0, removed);
      }

      const reordered = next.map((step, index) => ({
        ...step,
        position: index + 1,
      }));

      setDisplaySteps(reordered);
      syncToParent(reordered);
      setActiveId(null);
    },
    [displaySteps, syncToParent],
  );

  return (
    <div className="relative flex flex-col border border-border bg-background">
      {/* Header */}
      <div className="p-4">
        <p className="type-p !font-medium text-primary">Journey</p>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[180px_1fr]">
        <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
          Step
        </div>
        <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border">
          Operator
        </div>
      </div>

      {/* Empty State or Journey Rows - min-height with growth */}
      <div className="min-h-[200px]">
        {displaySteps.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-[200px]">
            <p className="type-p text-tertiary">No journey steps added</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addJourneyStep}
            >
              <Icons.Plus className="h-4 w-4" />
              <span className="px-1">Add step</span>
            </Button>
          </div>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displaySteps.map((step) => step.id)}
                strategy={verticalListSortingStrategy}
              >
                {displaySteps.map((step) => (
                  <DraggableJourneyRow
                    key={step.id}
                    journeyStep={step}
                    onStepChange={(value) =>
                      updateJourneyStep(step.id, { step: value })
                    }
                    onOperatorsChange={(newOperators) =>
                      handleOperatorsChange(step.id, newOperators)
                    }
                    onDelete={() => deleteJourneyStep(step.id)}
                    availableOperators={availableOperators}
                    onOperatorJustCreated={(operatorId, operatorName) =>
                      handleOperatorJustCreated(
                        step.id,
                        operatorId,
                        operatorName,
                      )
                    }
                  />
                ))}
              </SortableContext>
              {typeof window !== "undefined" &&
                createPortal(
                  <DragOverlay dropAnimation={null}>
                    {activeStep ? (
                      <div className="grid grid-cols-[180px_1fr] bg-background shadow-lg border border-border opacity-95">
                        <div className="border-r border-border px-2 py-[9.5px] flex items-start">
                          <div className="flex items-center gap-2 flex-1">
                            <Icons.GripVertical className="h-4 w-4 text-tertiary flex-shrink-0" />
                            <span
                              className={cn(
                                "type-p",
                                activeStep.step
                                  ? "text-primary"
                                  : "text-tertiary",
                              )}
                            >
                              {activeStep.step || "Select step"}
                            </span>
                          </div>
                        </div>
                        <div className="px-4 py-[5px] flex flex-wrap items-center gap-1.5">
                          {activeStep.operators.map((op) => (
                            <div
                              key={op.id}
                              className="flex items-center justify-center px-2 h-6 border border-border rounded-full bg-background"
                            >
                              <span className="type-small leading-none text-primary">
                                {op.name}
                              </span>
                            </div>
                          ))}
                          <span className="border-b border-border type-p text-tertiary">
                            Select operator
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )}
            </DndContext>
          </>
        )}
      </div>

      {/* Add Journey Step Button - Only show if steps exist */}
      {displaySteps.length > 0 && (
        <div className="bg-accent-light border-t border-border px-4 py-3 -mt-px">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addJourneyStep}
          >
            <Icons.Plus className="h-4 w-4" />
            <span className="px-1">Add step</span>
          </Button>
        </div>
      )}
    </div>
  );
}
