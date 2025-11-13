"use client";

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
    name: string;
    startDate: Date | null;
    endDate: Date | null;
    ongoing: boolean;
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

  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [ongoing, setOngoing] = React.useState(false);
  // Preserve dates when toggling ongoing to allow restoration
  const [preservedStartDate, setPreservedStartDate] =
    React.useState<Date | null>(null);
  const [preservedEndDate, setPreservedEndDate] = React.useState<Date | null>(
    null,
  );

  // API mutation for creating season
  const createSeasonMutation = useMutation(
    trpc.brand.seasons.create.mutationOptions(),
  );

  // Prefill name when modal opens with provided initialName
  React.useEffect(() => {
    if (open) {
      setName(initialName ?? "");
    }
  }, [open, initialName]);

  // Handle ongoing toggle with date preservation
  React.useEffect(() => {
    if (ongoing) {
      // Preserve current dates (including null) before clearing
      setPreservedStartDate(startDate);
      setPreservedEndDate(endDate);
      setStartDate(null);
      setEndDate(null);
    } else {
      // Restore preserved dates when toggling back
      setStartDate(preservedStartDate);
      setEndDate(preservedEndDate);
    }
  }, [ongoing]);

  const handleSave = async () => {
    // Validate dates for non-ongoing seasons
    if (!ongoing) {
      if (!startDate || !endDate) {
        toast.error("Please provide both start and end dates");
        return;
      }
      if (startDate > endDate) {
        toast.error("Start date must be before end date");
        return;
      }
    }

    try {
      // Format dates as YYYY-MM-DD strings for API (using local timezone)
      const formatDate = (date: Date | null) => {
        if (!date) return undefined;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Call API to create season immediately
      const result = await createSeasonMutation.mutateAsync({
        name: name.trim(),
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        ongoing: ongoing,
      });

      const createdSeason = result?.data;
      if (!createdSeason) {
        throw new Error("No season returned from API");
      }

      // Invalidate passportFormReferences query so dropdown updates
      await queryClient.invalidateQueries({
        queryKey: trpc.composite.passportFormReferences.queryKey(),
      });

      // Call parent callback with season data
      onSave({
        name: createdSeason.name,
        startDate: createdSeason.startDate ? new Date(createdSeason.startDate) : null,
        endDate: createdSeason.endDate ? new Date(createdSeason.endDate) : null,
        ongoing: createdSeason.ongoing,
      });

      // Show success message
      toast.success("Season created successfully");

      // Reset form
      setName("");
      setStartDate(null);
      setEndDate(null);
      setOngoing(false);
      setPreservedStartDate(null);
      setPreservedEndDate(null);
      
      // Close modal
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create season:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create season. Please try again.",
      );
    }
  };

  const handleCancel = () => {
    // Reset form
    setName("");
    setStartDate(null);
    setEndDate(null);
    setOngoing(false);
    setPreservedStartDate(null);
    setPreservedEndDate(null);
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
            <Label>Season</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter season name"
              className="h-9"
            />
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
                  onChange={(event) => setOngoing(event.target.checked)}
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
