"use client";

/**
 * StatusSidebar
 *
 * Sidebar component for product forms showing status selector.
 */

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@v1/ui/select";
import * as React from "react";

const STATUS_OPTIONS = [
  {
    value: "published",
    label: "Published",
    icon: <Icons.StatusPublished width={14} height={14} />,
  },
  {
    value: "unpublished",
    label: "Unpublished",
    icon: <Icons.StatusUnpublished width={14} height={14} />,
  },
  {
    value: "archived",
    label: "Archived",
    icon: <Icons.StatusArchived width={14} height={14} />,
  },
  {
    value: "scheduled",
    label: "Scheduled",
    icon: <Icons.StatusScheduled width={14} height={14} />,
  },
];

interface StatusSidebarProps {
  status: string;
  setStatus: (value: string) => void;
}

export function StatusSidebar({ status, setStatus }: StatusSidebarProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = STATUS_OPTIONS.find((o) => o.value === status);
  const displayValue = selectedOption?.label || "Select status";
  const displayIcon = selectedOption?.icon;
  const isPlaceholder = !selectedOption;

  const handleSelect = (value: string) => {
    setStatus(value);
    setOpen(false);
  };

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      <p className="type-p !font-medium text-primary">Status</p>
      <Select open={open} onOpenChange={setOpen}>
        <SelectTrigger asChild>
          <Button
            variant="outline"
            size="default"
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2 px-1">
              {displayIcon}
              <span className={cn(isPlaceholder && "text-tertiary")}>
                {displayValue}
              </span>
            </div>
            <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
          </Button>
        </SelectTrigger>
        <SelectContent defaultValue={status}>
          <SelectList>
            <SelectGroup>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <span className="type-p">{option.label}</span>
                  </div>
                  {status === option.value && (
                    <Icons.Check className="h-4 w-4" />
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectList>
        </SelectContent>
      </Select>
    </div>
  );
}
