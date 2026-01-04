"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectSearch,
  SelectTrigger,
} from "@v1/ui/select";
import { format } from "date-fns";
import * as React from "react";

export interface Season {
  id: string;
  name: string;
  startDate?: Date | null;
  endDate?: Date | null;
  isOngoing?: boolean;
}

interface SeasonSelectProps {
  value: Season | null;
  onValueChange: (value: Season) => void;
  onCreateNew?: (searchTerm: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function formatSeasonDateRange(season: Season): string {
  if (season.isOngoing) {
    return "";
  }

  if (!season.startDate || !season.endDate) {
    return "";
  }

  const startMonth = format(season.startDate, "MMMM yyyy");
  const endMonth = format(season.endDate, "MMMM yyyy");

  return `${startMonth} to ${endMonth}`;
}

function renderSeasonDateRange(season: Season): React.ReactNode {
  const dateRange = formatSeasonDateRange(season);
  return dateRange ? (
    <span className="type-p text-tertiary">{dateRange}</span>
  ) : season.isOngoing ? (
    <span className="type-p text-tertiary">Ongoing</span>
  ) : null;
}

export function SeasonSelect({
  value,
  onValueChange,
  onCreateNew,
  placeholder = "Select season...",
  disabled = false,
  className,
}: SeasonSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { seasons } = useBrandCatalog();

  const handleSelect = (season: Season) => {
    onValueChange(season);
    setOpen(false);
    setSearchTerm("");
  };

  const handleCreate = () => {
    if (onCreateNew && searchTerm.trim()) {
      onCreateNew(searchTerm.trim());
      setOpen(false);
      setSearchTerm("");
    }
  };

  const filteredSeasons = React.useMemo(() => {
    if (!searchTerm.trim()) return seasons;
    const query = searchTerm.toLowerCase().trim();
    return seasons.filter((s: Season) =>
      s.name.toLowerCase().includes(query),
    );
  }, [seasons, searchTerm]);

  const showCreateOption =
    searchTerm.trim() &&
    onCreateNew &&
    !seasons.some(
      (s: Season) => s.name.toLowerCase() === searchTerm.trim().toLowerCase(),
    );

  const hasResults = filteredSeasons.length > 0;
  const isPlaceholder = !value;

  return (
    <Select open={open} onOpenChange={setOpen}>
      <SelectTrigger asChild>
        <Button
          variant="outline"
          size="default"
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          {value ? (
            <div className="flex items-center gap-2 px-1">
              <span className="type-p text-primary">{value.name}</span>
              {renderSeasonDateRange(value)}
            </div>
          ) : (
            <span className={cn("px-1", isPlaceholder && "text-tertiary")}>
              {placeholder}
            </span>
          )}
          <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
        </Button>
      </SelectTrigger>
      <SelectContent shouldFilter={false}>
        <SelectSearch
          placeholder="Search..."
          value={searchTerm}
          onValueChange={setSearchTerm}
        />
        <SelectList>
          {hasResults ? (
            <SelectGroup>
              {filteredSeasons.map((season: Season) => (
                <SelectItem
                  key={season.id}
                  value={season.name}
                  onSelect={() => handleSelect(season)}
                >
                  <div className="flex items-center gap-2">
                    <span className="type-p text-primary">{season.name}</span>
                    {renderSeasonDateRange(season)}
                  </div>
                  {value?.id === season.id && (
                    <Icons.Check className="h-4 w-4" />
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : showCreateOption ? (
            <SelectGroup>
              <SelectItem value={searchTerm.trim()} onSelect={handleCreate}>
                <div className="flex items-center gap-2">
                  <Icons.Plus className="h-3.5 w-3.5" />
                  <span className="type-p text-primary">
                    Create &quot;{searchTerm.trim()}&quot;
                  </span>
                </div>
              </SelectItem>
            </SelectGroup>
          ) : onCreateNew && !searchTerm.trim() ? (
            <SelectEmpty>Start typing to create...</SelectEmpty>
          ) : (
            <SelectEmpty>No items found.</SelectEmpty>
          )}
        </SelectList>
      </SelectContent>
    </Select>
  );
}
