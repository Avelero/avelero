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
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type JourneyStep,
  usePassportFormContext,
} from "@/components/passports/form/context/passport-form-context";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Command,
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

const StepDropdown = ({
  step,
  availableSteps,
  onStepChange,
  isDragging,
  dragAttributes,
  dragListeners,
}: {
  step: string;
  availableSteps: Array<{ value: string; label: string }>;
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

  const filteredOptions = availableSteps.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()),
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
                    const isSelected = step === option.value;
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => handleSelect(option.value)}
                        className="justify-between"
                      >
                        <span className="type-p">{option.label}</span>
                        {isSelected && (
                          <Icons.Check className="h-4 w-4 text-brand" />
                        )}
                      </CommandItem>
                    );
                  })
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const OperatorCell = ({
  facilityId,
  facilityName,
  availableFacilities,
  onFacilityChange,
  onDelete,
}: {
  facilityId: string | null;
  facilityName: string;
  availableFacilities: Array<{ value: string; label: string }>;
  onFacilityChange: (facilityId: string, facilityName: string) => void;
  onDelete: () => void;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [operatorSheetOpen, setOperatorSheetOpen] = React.useState(false);
  const [newOperatorName, setNewOperatorName] = React.useState("");

  const handleSelect = (selectedFacilityId: string, selectedFacilityName: string) => {
    onFacilityChange(selectedFacilityId, selectedFacilityName);
    setSearchQuery("");
    setDropdownOpen(false);
  };

  const handleCreate = () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      // Open operator sheet with the searched name
      setNewOperatorName(trimmedQuery);
      setOperatorSheetOpen(true);
      setSearchQuery("");
      setDropdownOpen(false);
    }
  };

  const handleOperatorCreated = (operator: OperatorData) => {
    // Add the newly created operator/facility
    onFacilityChange(operator.id, operator.name);
    setNewOperatorName("");
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const filteredFacilities = availableFacilities.filter((facility) =>
    facility.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
              {facilityName && (
                <div className="px-2 h-6 flex items-center justify-center border border-border rounded-full bg-background type-small text-primary max-w-[132px]">
                  <span className="truncate">{facilityName}</span>
                </div>
              )}
              <span className="border-b border-border type-p ml-2 text-tertiary group-hover:text-secondary group-hover:border-secondary transition-colors">
                {facilityName ? "Change operator" : "Add operator"}
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
                {filteredFacilities.length > 0 ? (
                  filteredFacilities.map((facility) => {
                    const isSelected = facilityId === facility.value;
                    return (
                      <CommandItem
                        key={facility.value}
                        value={facility.label}
                        onSelect={() => handleSelect(facility.value, facility.label)}
                        className="justify-between"
                      >
                        <span className="type-p">{facility.label}</span>
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
                ) : (
                  <div className="px-3 py-9 text-center">
                    <p className="type-p text-tertiary">Start typing to create</p>
                  </div>
                )}
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
  availableSteps,
  availableFacilities,
  onStepChange,
  onFacilityChange,
  onDelete,
}: {
  journeyStep: JourneyStep;
  availableSteps: Array<{ value: string; label: string }>;
  availableFacilities: Array<{ value: string; label: string }>;
  onStepChange: (step: string) => void;
  onFacilityChange: (facilityId: string, facilityName: string) => void;
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
          step={journeyStep.stepType}
          availableSteps={availableSteps}
          onStepChange={onStepChange}
          isDragging={isDragging}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      </div>

      {/* Operator Column */}
      <div className="border-b border-border">
        <OperatorCell
          facilityId={journeyStep.facilityId}
          facilityName={journeyStep.facilityName}
          availableFacilities={availableFacilities}
          onFacilityChange={onFacilityChange}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

export function JourneySection() {
  const {
    formState,
    referenceData,
    addJourneyStep,
    updateJourneyStep,
    removeJourneyStep,
    reorderJourneySteps,
  } = usePassportFormContext();

  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const activeStep = React.useMemo(
    () => formState.journeySteps.find((step) => step.id === activeId),
    [activeId, formState.journeySteps],
  );

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

      const oldIndex = formState.journeySteps.findIndex((i) => i.id === active.id);
      const newIndex = formState.journeySteps.findIndex((i) => i.id === over.id);

      // If we can't find the indices, don't reorder
      if (oldIndex === -1 || newIndex === -1) {
        setActiveId(null);
        return;
      }

      reorderJourneySteps(oldIndex, newIndex);
      setActiveId(null);
    },
    [formState.journeySteps, reorderJourneySteps],
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

      {/* Empty State or Journey Rows - with fixed height and scroll */}
      <div className="h-[200px] overflow-y-auto scrollbar-hide">
        {formState.journeySteps.length === 0 ? (
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
                items={formState.journeySteps.map((step) => step.id)}
                strategy={verticalListSortingStrategy}
              >
                {formState.journeySteps.map((step) => (
                  <DraggableJourneyRow
                    key={step.id}
                    journeyStep={step}
                    availableSteps={referenceData.productionSteps}
                    availableFacilities={referenceData.facilities}
                    onStepChange={(value) =>
                      updateJourneyStep(step.id, { stepType: value })
                    }
                    onFacilityChange={(facilityId, facilityName) =>
                      updateJourneyStep(step.id, { facilityId, facilityName })
                    }
                    onDelete={() => removeJourneyStep(step.id)}
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
                                activeStep.stepType
                                  ? "text-primary"
                                  : "text-tertiary",
                              )}
                            >
                              {activeStep.stepType || "Select step"}
                            </span>
                          </div>
                        </div>
                        <div className="px-2 py-2 flex items-start justify-between">
                          <div className="flex flex-wrap items-center flex-1 gap-1.5">
                            {activeStep.facilityName && (
                              <div className="flex flex-wrap gap-1.5">
                                <div className="px-2 h-6 flex items-center justify-center border border-border rounded-full bg-background type-small text-primary max-w-[140px]">
                                  <span className="truncate">
                                    {activeStep.facilityName}
                                  </span>
                                </div>
                              </div>
                            )}
                            <span className="type-p text-tertiary ml-2">
                              {activeStep.facilityName
                                ? "Change operator"
                                : "Add operator"}
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
      {formState.journeySteps.length > 0 && (
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
