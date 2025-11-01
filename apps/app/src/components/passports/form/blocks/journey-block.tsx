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
  operators: string[];
  position: number;
}

// Use production steps from selections package
const STEP_OPTIONS = productionStepNames;

// TODO: Load operators from API
const OPERATOR_OPTIONS = [
  "Sinopec Group",
  "Indorama Ventures",
  "Hengli Group",
  "Hebei Loto Garment Co., Ltd",
  "Nike Manufacturing",
  "Adidas Production",
  "H&M Supply Chain",
  "Zara Manufacturing",
];

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
  dragAttributes: any;
  dragListeners: any;
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
                  ? "text-primary group-hover:text-secondary group-hover:border-secondary"
                  : "text-tertiary group-hover:text-secondary group-hover:border-secondary",
              )}
            >
              {step || "Select step"}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-64"
          align="start"
          alignOffset={-40}
          sideOffset={4}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search steps..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
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
                    <div className="flex items-center gap-2">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary">
                        Create &quot;{searchQuery.trim()}&quot;
                      </span>
                    </div>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const OperatorTags = ({
  operators,
  onRemoveOperator,
}: {
  operators: string[];
  onRemoveOperator: (operator: string) => void;
}) => {
  const [hoveredOperator, setHoveredOperator] = React.useState<string | null>(
    null,
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {operators.map((operator) => (
        <div
          key={operator}
          className="relative px-2 h-6 flex items-center justify-center border border-border rounded-full bg-background type-small text-primary max-w-[132px]"
          onMouseEnter={() => setHoveredOperator(operator)}
          onMouseLeave={() => setHoveredOperator(null)}
        >
          <span className="truncate">{operator}</span>
          {hoveredOperator === operator && (
            <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center">
              <div className="w-3 h-3 bg-gradient-to-r from-transparent to-background" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveOperator(operator);
                }}
                className="w-4 h-4 flex rounded-r-full rounded-l-md items-center justify-center bg-background text-tertiary hover:text-destructive transition-colors"
              >
                <Icons.X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const OperatorCell = ({
  operators,
  onOperatorsChange,
  onDelete,
}: {
  operators: string[];
  onOperatorsChange: (operators: string[]) => void;
  onDelete: () => void;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [operatorSheetOpen, setOperatorSheetOpen] = React.useState(false);
  const [newOperatorName, setNewOperatorName] = React.useState("");

  const handleSelect = (selectedOperator: string) => {
    if (operators.includes(selectedOperator)) {
      // Deselect if already selected
      onOperatorsChange(operators.filter((op) => op !== selectedOperator));
    } else {
      // Add if not selected
      onOperatorsChange([...operators, selectedOperator]);
    }
    setSearchQuery("");
  };

  const handleCreate = () => {
    const trimmedQuery = searchQuery.trim();
    if (
      trimmedQuery &&
      !OPERATOR_OPTIONS.includes(trimmedQuery) &&
      !operators.includes(trimmedQuery)
    ) {
      // Open operator sheet with the searched name
      setNewOperatorName(trimmedQuery);
      setOperatorSheetOpen(true);
      setSearchQuery("");
      setDropdownOpen(false);
    }
  };

  const handleOperatorCreated = (operator: OperatorData) => {
    // Add the newly created operator to the list
    onOperatorsChange([...operators, operator.name]);
    setNewOperatorName("");
  };

  const handleRemoveOperator = (operatorToRemove: string) => {
    onOperatorsChange(operators.filter((op) => op !== operatorToRemove));
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <PopoverTrigger asChild>
          <div
            className="group flex items-start justify-between w-full h-full px-2 py-2"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            role="button"
            tabIndex={0}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {operators.length > 0 && (
                <OperatorTags
                  operators={operators}
                  onRemoveOperator={handleRemoveOperator}
                />
              )}
              <span className="border-b border-border type-p ml-2 text-tertiary group-hover:text-secondary group-hover:border-secondary transition-colors">
                Add operator
              </span>
            </div>

            <div
              className="w-6 flex justify-center ml-2"
              onClick={handleMenuClick}
            >
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "p-1 hover:bg-accent transition-colors",
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
                    <Icons.X className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent className="p-0 w-60" align="start" sideOffset={4}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search operators..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandGroup>
                {OPERATOR_OPTIONS.filter((option) =>
                  option.toLowerCase().includes(searchQuery.toLowerCase()),
                ).length > 0 ? (
                  OPERATOR_OPTIONS.filter((option) =>
                    option.toLowerCase().includes(searchQuery.toLowerCase()),
                  ).map((option) => {
                    const isSelected = operators.includes(option);
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
                ) : searchQuery.trim() &&
                  !OPERATOR_OPTIONS.includes(searchQuery.trim()) &&
                  !operators.includes(searchQuery.trim()) ? (
                  <CommandItem
                    value={searchQuery.trim()}
                    onSelect={handleCreate}
                  >
                    <div className="flex items-center gap-2">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary">
                        Create &quot;{searchQuery.trim()}&quot;
                      </span>
                    </div>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <OperatorSheet
        open={operatorSheetOpen}
        onOpenChange={setOperatorSheetOpen}
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
}: {
  journeyStep: JourneyStep;
  onStepChange: (step: string) => void;
  onOperatorsChange: (operators: string[]) => void;
  onDelete: () => void;
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
        />
      </div>
    </div>
  );
}

export function JourneySection() {
  const [journeySteps, setJourneySteps] = React.useState<JourneyStep[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const activeStep = React.useMemo(
    () => journeySteps.find((step) => step.id === activeId),
    [activeId, journeySteps],
  );

  const updateJourneyStep = (
    id: string,
    field: keyof Omit<JourneyStep, "position">,
    value: any,
  ) => {
    setJourneySteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, [field]: value } : step)),
    );
  };

  const deleteJourneyStep = (id: string) => {
    setJourneySteps((prev) => {
      const filteredSteps = prev.filter((step) => step.id !== id);
      return filteredSteps.map((step, index) => ({
        ...step,
        position: index + 1,
      }));
    });
  };

  const addJourneyStep = () => {
    const newStep: JourneyStep = {
      id: Date.now().toString(),
      step: "",
      operators: [],
      position: journeySteps.length + 1,
    };
    setJourneySteps((prev) => [...prev, newStep]);
  };

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    // Guard against dropping outside droppable area
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    setJourneySteps((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      // If we can't find the indices, don't reorder
      if (oldIndex === -1 || newIndex === -1) {
        return items;
      }

      const next = [...items];
      const [removed] = next.splice(oldIndex, 1);
      if (removed) {
        next.splice(newIndex, 0, removed);
      }

      return next.map((step, index) => ({
        ...step,
        position: index + 1,
      }));
    });
    setActiveId(null);
  }, []);

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

      {/* Empty State or Journey Rows - with fixed height and scroll */}
      <div className="h-[200px] overflow-y-auto scrollbar-hide">
        {journeySteps.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full">
            <p className="type-p text-tertiary">No journey steps added</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addJourneyStep}
              icon={<Icons.Plus className="h-4 w-4" />}
              iconPosition="left"
            >
              Add step
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
                items={journeySteps.map((step) => step.id)}
                strategy={verticalListSortingStrategy}
              >
                {journeySteps.map((step) => (
                  <DraggableJourneyRow
                    key={step.id}
                    journeyStep={step}
                    onStepChange={(value) =>
                      updateJourneyStep(step.id, "step", value)
                    }
                    onOperatorsChange={(value) =>
                      updateJourneyStep(step.id, "operators", value)
                    }
                    onDelete={() => deleteJourneyStep(step.id)}
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
                        <div className="px-2 py-2 flex items-start justify-between">
                          <div className="flex flex-wrap items-center flex-1 gap-1.5">
                            {activeStep.operators.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {activeStep.operators.map((operator) => (
                                  <div
                                    key={operator}
                                    className="px-2 h-6 flex items-center justify-center border border-border rounded-full bg-background type-small text-primary max-w-[140px]"
                                  >
                                    <span className="truncate">{operator}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <span className="type-p text-tertiary ml-2">
                              Add operator
                            </span>
                          </div>
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
      {journeySteps.length > 0 && (
        <div className="bg-accent-light border-t border-border px-4 py-3 -mt-px">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addJourneyStep}
            icon={<Icons.Plus className="h-4 w-4" />}
            iconPosition="left"
          >
            Add step
          </Button>
        </div>
      )}
    </div>
  );
}
