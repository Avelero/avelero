"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
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

export function SeasonSelect({
  value,
  onValueChange,
  onCreateNew,
  placeholder = "Select season",
  disabled = false,
  className,
}: SeasonSelectProps) {
  const trpc = useTRPC();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Fetch seasons from API
  const { data: seasonsData, isLoading } = useQuery(
    trpc.brand.seasons.list.queryOptions({}),
  );

  // Transform API response to Season interface
  const seasons = React.useMemo(() => {
    if (!seasonsData?.data) return [];
    return seasonsData.data.map((s) => ({
      id: s.id,
      name: s.name,
      startDate: s.start_date ? new Date(s.start_date) : null,
      endDate: s.end_date ? new Date(s.end_date) : null,
      isOngoing: s.ongoing,
    }));
  }, [seasonsData]);

  const handleSelect = (season: Season) => {
    onValueChange(season);
    setOpen(false);
    setSearchTerm("");
  };

  const handleCreate = () => {
    if (onCreateNew && searchTerm) {
      onCreateNew(searchTerm);
      setOpen(false);
      setSearchTerm("");
    }
  };

  const filteredSeasons = React.useMemo(() => {
    if (!searchTerm) return seasons;
    return seasons.filter((s: Season) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [seasons, searchTerm]);

  const showCreateOption =
    searchTerm &&
    !seasons.some(
      (s: Season) => s.name.toLowerCase() === searchTerm.toLowerCase(),
    );

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
              {isLoading ? (
                <div className="px-3 py-8 text-center">
                  <p className="type-p text-tertiary">Loading seasons...</p>
                </div>
              ) : filteredSeasons.length > 0 ? (
                filteredSeasons.map((season: Season) => (
                  <CommandItem
                    key={season.id}
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
                    {value?.id === season.id && (
                      <Icons.Check className="h-4 w-4" />
                    )}
                  </CommandItem>
                ))
              ) : searchTerm && showCreateOption && onCreateNew ? (
                <CommandItem value={searchTerm} onSelect={handleCreate}>
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
                    {seasons.length === 0
                      ? "Begin typing to create your first season"
                      : "No seasons found"}
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
