"use client";

import * as React from "react";
import { cn } from "@v1/ui/cn";
import { Button } from "@v1/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@v1/ui/command";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { format } from "date-fns";

export interface Season {
  name: string;
  startDate?: Date;
  endDate?: Date;
  isOngoing?: boolean;
}

interface SeasonSelectProps {
  value: Season | null;
  onValueChange: (value: Season) => void;
  seasons: Season[];
  onCreateNew?: (searchTerm: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Format a season's start and end dates as a human-readable month range.
 *
 * Returns an empty string if the season is marked ongoing or if either start or end date is missing.
 *
 * @param season - The season whose date range will be formatted
 * @returns The date range as "Month Year to Month Year", or an empty string when unavailable
 */
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

/**
 * Render a searchable popover dropdown for selecting an existing season or creating a new one.
 *
 * The control displays the selected season (name, optional formatted date range, and an "Ongoing" label),
 * filters the provided seasons by name as the user types (case-insensitive), and optionally offers a
 * "Create" option when the typed term does not match any existing season.
 *
 * @param value - The currently selected season, or `null` when none is selected.
 * @param onValueChange - Called with the chosen `Season` when the user selects an item.
 * @param seasons - Available seasons to display and filter.
 * @param onCreateNew - Optional callback invoked with the current search term when the user chooses to create a new season.
 * @param placeholder - Text shown when no season is selected.
 * @param disabled - Whether the control is disabled.
 * @param className - Additional CSS class names applied to the trigger button.
 * @returns The SeasonSelect React element.
 */
export function SeasonSelect({
  value,
  onValueChange,
  seasons,
  onCreateNew,
  placeholder = "Select season",
  disabled = false,
  className,
}: SeasonSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const handleSelect = (season: Season) => {
    onValueChange(season);
    setOpen(false);
    setSearchTerm("");
  };

  const handleCreate = () => {
    if (onCreateNew && searchTerm) {
      onCreateNew(searchTerm);
      setSearchTerm("");
    }
  };

  const filteredSeasons = React.useMemo(() => {
    if (!searchTerm) return seasons;
    return seasons.filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [seasons, searchTerm]);

  const showCreateOption = searchTerm && !seasons.some(s => s.name.toLowerCase() === searchTerm.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          disabled={disabled}
          className={cn("w-full justify-between h-9", className)}
          icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
        >
          {value ? (
            <div className="flex items-center gap-2">
              <span className="type-p text-primary">{value.name}</span>
              {formatSeasonDateRange(value) && (
                <span className="type-p text-tertiary">
                  {formatSeasonDateRange(value)}
                </span>
              )}
              {value.isOngoing && (
                <span className="type-p text-tertiary">Ongoing</span>
              )}
            </div>
          ) : (
            <span className="text-tertiary">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search seasons..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandGroup>
              {filteredSeasons.length > 0 ? (
                filteredSeasons.map((season) => (
                  <CommandItem
                    key={season.name}
                    value={season.name}
                    onSelect={() => handleSelect(season)}
                    className="justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="type-p text-primary">{season.name}</span>
                      {formatSeasonDateRange(season) && (
                        <span className="type-p text-tertiary">
                          {formatSeasonDateRange(season)}
                        </span>
                      )}
                      {season.isOngoing && (
                        <span className="type-p text-tertiary">Ongoing</span>
                      )}
                    </div>
                    {value?.name === season.name && (
                      <Icons.Check className="h-4 w-4" />
                    )}
                  </CommandItem>
                ))
              ) : searchTerm && showCreateOption && onCreateNew ? (
                <CommandItem
                  value={searchTerm}
                  onSelect={handleCreate}
                >
                  <div className="flex items-center gap-2">
                    <Icons.Plus className="h-3.5 w-3.5" />
                    <span className="type-p text-primary">
                      Create &quot;{searchTerm}&quot;
                    </span>
                  </div>
                </CommandItem>
              ) : !searchTerm ? (
                <div className="px-3 py-8 text-center">
                  <p className="type-p text-tertiary">
                    Begin typing to create your first season
                  </p>
                </div>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


