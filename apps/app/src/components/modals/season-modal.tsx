"use client";

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
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [ongoing, setOngoing] = React.useState(false);
  // Preserve dates when toggling ongoing to allow restoration
  const [preservedStartDate, setPreservedStartDate] = React.useState<
    Date | null
  >(null);
  const [preservedEndDate, setPreservedEndDate] = React.useState<Date | null>(
    null,
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
      // Preserve current dates before clearing
      if (startDate) setPreservedStartDate(startDate);
      if (endDate) setPreservedEndDate(endDate);
      setStartDate(null);
      setEndDate(null);
    } else {
      // Restore preserved dates when toggling back
      if (preservedStartDate) setStartDate(preservedStartDate);
      if (preservedEndDate) setEndDate(preservedEndDate);
    }
  }, [ongoing]);

  const handleSave = () => {
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

    // TODO: Save to backend
    onSave({ name, startDate, endDate, ongoing });
    // Reset form
    setName("");
    setStartDate(null);
    setEndDate(null);
    setOngoing(false);
    setPreservedStartDate(null);
    setPreservedEndDate(null);
    onOpenChange(false);
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
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSave} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
