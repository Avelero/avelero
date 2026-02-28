"use client";

import { MainSkeleton } from "@/components/main-skeleton";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

const PHASES = [
  "demo",
  "trial",
  "expired",
  "active",
  "past_due",
  "suspended",
  "cancelled",
] as const;

type SortBy =
  | "name"
  | "phase"
  | "plan"
  | "sku_usage"
  | "trial_ends"
  | "members"
  | "created";

type SortDir = "asc" | "desc";
type PhaseFilter = (typeof PHASES)[number] | "all";
type DataType = "text" | "number" | "date";

type SortState = {
  field: SortBy;
  direction: SortDir;
};

const SORT_FIELDS: Array<{ id: SortBy; label: string; dataType: DataType }> = [
  { id: "name", label: "Brand name", dataType: "text" },
  { id: "phase", label: "Phase", dataType: "text" },
  { id: "plan", label: "Plan", dataType: "text" },
  { id: "sku_usage", label: "SKU usage", dataType: "number" },
  { id: "trial_ends", label: "Trial ends", dataType: "date" },
  { id: "members", label: "Members", dataType: "number" },
  { id: "created", label: "Created", dataType: "date" },
];

const PHASE_OPTIONS: Array<{ value: PhaseFilter; label: string }> = [
  { value: "all", label: "All phases" },
  ...PHASES.map((phase) => ({
    value: phase,
    label: phase.replace(/_/g, " "),
  })),
];

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function phaseBadgeClass(phase: string) {
  if (phase === "active") return "bg-success-brand text-success-brand-foreground";
  if (phase === "trial") return "bg-accent-blue text-primary";
  if (phase === "past_due" || phase === "expired") {
    return "bg-accent-red text-destructive";
  }
  if (phase === "suspended" || phase === "cancelled") {
    return "bg-accent-dark text-secondary";
  }
  return "bg-accent text-primary";
}

function getSortIcon(dataType: DataType, direction: SortDir) {
  if (dataType === "text") {
    return direction === "asc" ? Icons.ArrowUpZA : Icons.ArrowDownZA;
  }
  if (dataType === "number") {
    return direction === "asc" ? Icons.ArrowUp10 : Icons.ArrowDown10;
  }
  return direction === "asc" ? Icons.CalendarArrowUp : Icons.CalendarArrowDown;
}

function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void } | { label: string; href: string };
}) {
  return (
    <div className="flex w-full h-[280px] items-center justify-center border border-border">
      <div className="flex max-w-[520px] flex-col items-center gap-3 text-center">
        <h3 className="type-h5 text-primary">{title}</h3>
        <p className="type-p text-secondary">{description}</p>
        {action ? (
          <div className="pt-2">
            {"href" in action ? (
              <Button asChild variant="default" size="default">
                <Link href={action.href} prefetch>
                  {action.label}
                </Link>
              </Button>
            ) : (
              <Button onClick={action.onClick} variant="default" size="default">
                {action.label}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SortPopover({
  sortState,
  onSortChange,
}: {
  sortState: SortState | null;
  onSortChange: (sort: SortState | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [optimisticSort, setOptimisticSort] = useState<SortState | null>(
    sortState,
  );

  useEffect(() => {
    if (!isPending) {
      setOptimisticSort(sortState);
    }
  }, [sortState, isPending]);

  const activeField = optimisticSort
    ? SORT_FIELDS.find((field) => field.id === optimisticSort.field)
    : null;
  const activeDirection: SortDir = optimisticSort?.direction ?? "desc";
  const ActiveIcon = activeField
    ? getSortIcon(activeField.dataType, activeDirection)
    : Icons.ArrowDownUp;

  const handleSortSelect = useCallback(
    (fieldId: SortBy, direction: SortDir) => {
      const nextSort = { field: fieldId, direction };
      setOptimisticSort(nextSort);
      startTransition(() => {
        onSortChange(nextSort);
      });
      setOpen(false);
    },
    [onSortChange],
  );

  const handleClearSort = useCallback(() => {
    setOptimisticSort(null);
    startTransition(() => {
      onSortChange(null);
    });
  }, [onSortChange]);

  return (
    <div className="relative group inline-flex">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="subtle"
            size="default"
            className="group-hover:bg-accent transition-none data-[state=open]:bg-accent"
          >
            <ActiveIcon className="h-[14px] w-[14px]" />
            <span className="px-1">
              {optimisticSort && activeField ? (
                <>
                  Sorted by{" "}
                  <span className="font-medium pl-2 text-foreground">
                    {activeField.label}
                  </span>
                </>
              ) : (
                "Sort"
              )}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          {SORT_FIELDS.map((field) => {
            const AscIcon = getSortIcon(field.dataType, "asc");
            const DescIcon = getSortIcon(field.dataType, "desc");

            return (
              <DropdownMenuSub key={field.id}>
                <DropdownMenuSubTrigger>
                  <span>{field.label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-[220px]">
                    <DropdownMenuItem
                      onSelect={() => handleSortSelect(field.id, "asc")}
                    >
                      <span className="flex items-center">
                        <AscIcon className="h-[14px] w-[14px]" />
                        <span className="px-1">Ascending</span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleSortSelect(field.id, "desc")}
                    >
                      <span className="flex items-center">
                        <DescIcon className="h-[14px] w-[14px]" />
                        <span className="px-1">Descending</span>
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {optimisticSort ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleClearSort();
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-[35px] w-[35px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-accent before:absolute before:right-full before:top-0 before:bottom-0 before:w-8 before:bg-gradient-to-r before:from-transparent before:to-accent before:pointer-events-none z-10"
          aria-label="Clear sort"
        >
          <Icons.X className="h-3 w-3 text-secondary" />
        </button>
      ) : null}
    </div>
  );
}

function PhaseFilterPopover({
  phase,
  onPhaseChange,
}: {
  phase: PhaseFilter;
  onPhaseChange: (phase: PhaseFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = PHASE_OPTIONS.find((option) => option.value === phase);
  const hasActive = phase !== "all";

  return (
    <div className="relative group inline-flex">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="subtle"
            size="default"
            className="group-hover:bg-accent transition-none data-[state=open]:bg-accent"
          >
            <Icons.Filter className="h-[14px] w-[14px]" />
            <span className="px-1">{hasActive ? selected?.label : "Filter"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          {PHASE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onPhaseChange(option.value)}
            >
              <span className="flex items-center justify-between w-full">
                <span>{option.label}</span>
                {option.value === phase ? (
                  <Icons.Check className="h-[14px] w-[14px]" />
                ) : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {hasActive ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPhaseChange("all");
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-[35px] w-[35px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-accent before:absolute before:right-full before:top-0 before:bottom-0 before:w-8 before:bg-gradient-to-r before:from-transparent before:to-accent before:pointer-events-none z-10"
          aria-label="Clear filter"
        >
          <Icons.X className="h-3 w-3 text-secondary" />
        </button>
      ) : null}
    </div>
  );
}

export function BrandsDashboard() {
  const trpc = useTRPC();

  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [phase, setPhase] = useState<PhaseFilter>("all");
  const [sort, setSort] = useState<SortState | null>({
    field: "created",
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const queryInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      phase: phase === "all" ? undefined : phase,
      sort_by: sort?.field,
      sort_dir: sort?.direction,
      page,
      page_size: pageSize,
    }),
    [page, phase, search, sort],
  );

  const { data, isLoading } = useQuery(
    trpc.platformAdmin.brands.list.queryOptions(queryInput),
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = search.trim().length > 0 || phase !== "all";
  const hasNoRows = !isLoading && items.length === 0;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : (page - 1) * pageSize + items.length;

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const canGoFirst = canGoPrev;
  const canGoLast = canGoNext;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setPhase("all");
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 w-full">
        <div
          className={cn(
            "relative flex items-center transition-all",
            isSearchFocused ? "w-[340px]" : "w-[240px]",
          )}
        >
          <div
            className={cn(
              "absolute left-2 pointer-events-none text-tertiary",
              isSearchFocused ? "text-secondary" : "text-tertiary",
            )}
          >
            <Icons.Search className="h-4 w-4" />
          </div>
          <Input
            aria-label="Search brands"
            placeholder="Search..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="pl-8 pr-3 h-9 transition-transform"
          />
        </div>

        <SortPopover
          sortState={sort}
          onSortChange={(nextSort) => {
            setSort(nextSort);
            setPage(1);
          }}
        />

        <PhaseFilterPopover
          phase={phase}
          onPhaseChange={(nextPhase) => {
            setPhase(nextPhase);
            setPage(1);
          }}
        />

        <div className="flex-1" />

        <Button asChild>
          <Link href="/brands/create" prefetch>
            <span className="px-1">Create Brand</span>
          </Link>
        </Button>
      </div>

      {hasNoRows ? (
        hasActiveFilters ? (
          <EmptyPanel
            title="No results"
            description="Change your search query or filters."
            action={{ label: "Clear filters", onClick: clearFilters }}
          />
        ) : (
          <EmptyPanel
            title="No brands yet"
            description="Create your first brand to get started."
            action={{ label: "Create brand", href: "/brands/create" }}
          />
        )
      ) : (
        <>
          <div className="border bg-background overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>SKU Usage</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-[320px] p-0">
                      <MainSkeleton contained />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell className="font-medium">{brand.name}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs ${phaseBadgeClass(brand.phase)}`}
                        >
                          {brand.phase.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell>{brand.plan_type ?? "None"}</TableCell>
                      <TableCell>
                        {brand.sku_usage.used}
                        {brand.sku_usage.limit !== null
                          ? ` / ${brand.sku_usage.limit}`
                          : ""}
                      </TableCell>
                      <TableCell>{formatDate(brand.trial_ends_at)}</TableCell>
                      <TableCell>{brand.members_count}</TableCell>
                      <TableCell>{formatDate(brand.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/brands/${brand.id}`} prefetch>
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {isLoading ? null : (
            <div className="flex items-center justify-end gap-4 py-3">
              <div className="type-p text-secondary">
                {rangeStart} - {rangeEnd} of {total}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="First page"
                  onClick={() => setPage(1)}
                  disabled={!canGoFirst}
                >
                  <Icons.ChevronsLeft className="h-[14px] w-[14px]" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Previous page"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={!canGoPrev}
                >
                  <Icons.ChevronLeft className="h-[14px] w-[14px]" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Next page"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={!canGoNext}
                >
                  <Icons.ChevronRight className="h-[14px] w-[14px]" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Last page"
                  onClick={() => setPage(totalPages)}
                  disabled={!canGoLast}
                >
                  <Icons.ChevronsRight className="h-[14px] w-[14px]" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
