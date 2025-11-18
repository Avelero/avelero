"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

interface SeasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (season: {
    id: string;
    name: string;
    startDate: Date | null;
    endDate: Date | null;
    isOngoing: boolean;
  }) => void;
  initialName?: string;
}

export function SeasonModal({
  open,
  onOpenChange,
  onSave,
  initialName,
}: SeasonModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { seasons: existingSeasons } = useBrandCatalog();

  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [ongoing, setOngoing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Preserve dates when toggling ongoing to allow restoration
  const [preservedStartDate, setPreservedStartDate] =
    React.useState<Date | null>(null);
  const [preservedEndDate, setPreservedEndDate] = React.useState<Date | null>(
    null,
  );

  // Validation error state
  const [nameError, setNameError] = React.useState("");

  // API mutation for creating season
  const createSeasonMutation = useMutation(
    trpc.brand.seasons.create.mutationOptions(),
  );

  // Date formatting and parsing functions (memoized)
  const formatDate = React.useCallback((date: Date | null) => {
    if (!date) return undefined;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const parseDate = React.useCallback((dateValue: string | Date | null | undefined): Date | null => {
    if (!dateValue) return null;
    // If it's already a Date object, return it directly
    if (dateValue instanceof Date) return dateValue;
    // If it's a string, parse it
    if (typeof dateValue === 'string') {
      const parts = dateValue.split('-').map(Number);
      if (parts.length !== 3) return null;
      const [year, month, day] = parts;
      if (year === undefined || month === undefined || day === undefined) return null;
      return new Date(year, month - 1, day);
    }
    return null;
  }, []);

  // Prefill name when modal opens with provided initialName
  React.useEffect(() => {
    if (open) {
      setName(initialName ?? "");
    }
  }, [open, initialName]);

  // Validation function for season name
  const validateName = (value: string): boolean => {
    const trimmedName = value.trim();
    
    if (!trimmedName) {
      setNameError("Season name is required");
      return false;
    }

    const isDuplicate = existingSeasons.some(
      (season) => season.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setNameError("A season with this name already exists");
      return false;
    }

    setNameError("");
    return true;
  };

  // Handle ongoing toggle - only preserve and clear when turning ON
  const handleOngoingChange = (checked: boolean) => {
    if (checked) {
      // Turning ongoing ON - preserve current dates (including null) before clearing
      setPreservedStartDate(startDate);
      setPreservedEndDate(endDate);
      setStartDate(null);
      setEndDate(null);
    } else {
      // Turning ongoing OFF - restore preserved dates if available
      if (preservedStartDate !== null) setStartDate(preservedStartDate);
      if (preservedEndDate !== null) setEndDate(preservedEndDate);
      // Clear preserved dates after restoration
      setPreservedStartDate(null);
      setPreservedEndDate(null);
    }
    setOngoing(checked);
  };

  const handleSave = async () => {
    // Validate name
    const isNameValid = validateName(name);
    if (!isNameValid) {
      document.getElementById("season-name")?.focus();
      return;
    }

    // Validate dates for non-ongoing seasons
    if (!ongoing) {
      // Both dates must be provided together
      if (!startDate && !endDate) {
        toast.error("Please provide both start and end dates");
        return;
      }
      if (startDate && !endDate) {
        toast.error("End date is required when start date is provided");
        return;
      }
      if (!startDate && endDate) {
        toast.error("Start date is required when end date is provided");
        return;
      }
      if (startDate && endDate && startDate > endDate) {
        toast.error("Start date must be before end date");
        return;
      }
    }

    // Validate that dates are NOT set when ongoing is true
    if (ongoing && (startDate || endDate)) {
      toast.error("Ongoing seasons cannot have specific start/end dates");
      return;
    }

    // Show loading toast and execute mutation - wrap entire operation in promise
    // toast.loading will automatically handle success/error toasts
    await toast.loading(
      "Creating season...",
      (async () => {
        const result = await createSeasonMutation.mutateAsync({
          name: name.trim(),
          start_date: formatDate(startDate),
          end_date: formatDate(endDate),
          ongoing: ongoing,
        });

        const createdSeason = result?.data;
        if (!createdSeason?.id) {
          throw new Error("No valid response returned from API");
        }

        // Optimistically update the cache immediately
        queryClient.setQueryData(
          trpc.composite.brandCatalogContent.queryKey(),
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              brandCatalog: {
                ...old.brandCatalog,
                seasons: [
                  ...old.brandCatalog.seasons,
                  {
                    id: createdSeason.id,
                    name: createdSeason.name,
                    startDate: createdSeason.startDate,
                    endDate: createdSeason.endDate,
                    isOngoing: createdSeason.ongoing,
                    createdAt: createdSeason.createdAt,
                    updatedAt: createdSeason.updatedAt,
                  },
                ],
              },
            };
          },
        );

        // Invalidate to trigger background refetch
        queryClient.invalidateQueries({
        queryKey: trpc.composite.brandCatalogContent.queryKey(),
        });

        // Close modal first
        onOpenChange(false);

        // Call parent callback with transformed data
        // API returns Date objects from database (or null), use them directly
        onSave({
          id: createdSeason.id,
          name: createdSeason.name,
          startDate: createdSeason.startDate || null,
          endDate: createdSeason.endDate || null,
          isOngoing: createdSeason.ongoing,
        });

        return result;
      })(),
      {
        delay: 200,
        successMessage: "Season created successfully",
      },
    ).catch((error) => {
      // toast.loading already handles error toast, but we can log for debugging
      console.error("Failed to create season:", error);
    });
  };

  const handleCancel = () => {
    // Close modal (triggers reset via handleOpenChange)
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing by any method (overlay, escape, etc.)
      setName("");
      setStartDate(null);
      setEndDate(null);
      setOngoing(false);
      setPreservedStartDate(null);
      setPreservedEndDate(null);
      setNameError("");
    }
    onOpenChange(newOpen);
  };

  const isCreating = createSeasonMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Add season</DialogTitle>
        </DialogHeader>

        <div className="px-6 flex flex-col gap-3">
          {/* Season Name */}
          <div className="space-y-1.5">
            <Label htmlFor="season-name">
              Season <span className="text-destructive">*</span>
            </Label>
            <Input
              id="season-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) validateName(e.target.value);
              }}
              onBlur={() => validateName(name)}
              placeholder="Enter season name"
              className="h-9"
              maxLength={100}
              aria-required="true"
              required
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Date range</Label>
            </div>
            <div className="flex items-center gap-2">
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
                disabled={ongoing}
                className={ongoing ? "cursor-default" : undefined}
              />
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="End date"
                disabled={ongoing}
                className={ongoing ? "cursor-default" : undefined}
              />
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <span className="relative inline-flex h-4 w-4 items-center justify-center">
                <input
                  type="checkbox"
                  aria-label="Ongoing"
                  className="block h-4 w-4 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer outline-none focus:outline-none"
                  checked={ongoing}
                  onChange={(event) => handleOngoingChange(event.target.checked)}
                />
                {ongoing && (
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-[10px] h-[10px] bg-brand" />
                  </span>
                )}
              </span>
              <span className="type-p text-primary">
                This season is ongoing
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-3">
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSave} disabled={!name.trim() || isCreating}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
