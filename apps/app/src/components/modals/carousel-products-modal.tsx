"use client";

import { useTRPC } from "@/trpc/client";
import {
    CarouselProductsDataTable,
    CarouselTableSkeleton,
    type CarouselSelectionState,
} from "@/components/tables/carousel-products";
import { QuickFiltersPopover } from "@/components/select/filter-select";
import { SortPopover } from "@/components/select/sort-select";
import { useFilterState } from "@/hooks/use-filter-state";
import type { FilterActions, FilterState } from "@/components/passports/filter-types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface CarouselProductsModalProps {
    /**
     * Whether the modal is open
     */
    open: boolean;
    /**
     * Callback when the modal open state changes
     */
    onOpenChange: (open: boolean) => void;
    /**
     * Initial selection state from ThemeConfig
     */
    initialSelection: {
        filter?: FilterState;
        includeIds?: string[];
        excludeIds?: string[];
    };
    /**
     * Callback when the user saves their selection
     */
    onSave: (selection: {
        filter: FilterState | null;
        includeIds: string[];
        excludeIds: string[];
    }) => void;
}

type SortField = "name" | "category" | "season" | "createdAt";
type SortDirection = "asc" | "desc";

/**
 * Modal for selecting products for the DPP carousel.
 * Uses the same control patterns as the passports table.
 */
export function CarouselProductsModal({
    open,
    onOpenChange,
    initialSelection,
    onSave,
}: CarouselProductsModalProps) {
    // Search state
    const [searchValue, setSearchValue] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Sort state - null by default (uses database order, which is createdAt desc)
    const [sortState, setSortState] = useState<{
        field: string;
        direction: SortDirection;
    } | null>(null);

    // Filter state for quick filters
    const [filterState, filterActions] = useFilterState();

    // Selection state (local until saved)
    const [selection, setSelection] = useState<CarouselSelectionState>({
        mode: "explicit",
        includeIds: [],
        excludeIds: [],
    });

    // Pagination state
    const [cursor, setCursor] = useState<string | undefined>(undefined);

    // Track if we've initialized for this modal open
    const hasInitialized = useRef(false);

    // Track total for selected count display
    const [total, setTotal] = useState(0);

    // Reset state when modal opens
    useEffect(() => {
        if (open && !hasInitialized.current) {
            hasInitialized.current = true;
            setSearchValue("");
            setDebouncedSearch("");
            setCursor(undefined);
            setSortState(null);
            filterActions.clearAll();

            // Reset selection state
            const hasExclusions = initialSelection.excludeIds && initialSelection.excludeIds.length > 0;
            const hasInclusions = initialSelection.includeIds && initialSelection.includeIds.length > 0;

            if (hasExclusions) {
                setSelection({
                    mode: "all",
                    includeIds: [],
                    excludeIds: initialSelection.excludeIds ?? [],
                });
            } else {
                setSelection({
                    mode: "explicit",
                    includeIds: hasInclusions ? initialSelection.includeIds! : [],
                    excludeIds: [],
                });
            }
        } else if (!open) {
            // Reset the ref when modal closes
            hasInitialized.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialSelection.excludeIds, initialSelection.includeIds]);

    // Debounce search input
    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(searchValue);
            // Reset pagination when search changes
            setCursor(undefined);
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchValue]);

    // Map our sort state to API format
    const apiSort = useMemo(() => {
        if (!sortState) return undefined;
        // Map sort field IDs to API field names
        const fieldMap: Record<string, SortField> = {
            title: "name",
            productIdentifier: "name", // fallback
            category: "category",
            season: "season",
            createdAt: "createdAt",
            updatedAt: "createdAt", // fallback
        };
        const field = fieldMap[sortState.field] ?? "name";
        return { field, direction: sortState.direction };
    }, [sortState]);

    // Handle sort change (reset pagination)
    const handleSortChange = useCallback(
        (newSort: { field: string; direction: SortDirection } | null) => {
            setSortState(newSort);
            setCursor(undefined);
        },
        [],
    );

    // Handle load more
    const handleLoadMore = useCallback((nextCursor: string) => {
        setCursor(nextCursor);
    }, []);

    // Handle clear filters
    const handleClearFilters = useCallback(() => {
        setSearchValue("");
        filterActions.clearAll();
    }, [filterActions]);

    // Handle save
    const handleSave = () => {
        onSave({
            filter: filterState.groups.length > 0 ? filterState : null,
            includeIds: selection.mode === "explicit" ? selection.includeIds : [],
            excludeIds: selection.mode === "all" ? selection.excludeIds : [],
        });
        onOpenChange(false);
    };

    // Calculate selected count
    const selectedCount = useMemo(() => {
        if (selection.mode === "all") {
            return total - selection.excludeIds.length;
        }
        return selection.includeIds.length;
    }, [selection, total]);

    const hasFilters = debouncedSearch.length > 0 || filterState.groups.length > 0;

    // Only render the modal content when open
    if (!open) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[800px] p-0 gap-0 border border-border overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-border">
                    <DialogTitle className="text-foreground">
                        Select products
                    </DialogTitle>
                </DialogHeader>

                {/* Info message */}
                <div className="px-6 py-3 border-b border-border bg-accent-light">
                    <p className="type-small text-secondary">
                        The carousel will rotate between selected products, prioritizing those from relevant categories.
                    </p>
                </div>

                {/* Controls + Table - wrapped in single Suspense with skeleton */}
                <div className="px-6 py-4 min-h-[400px]">
                    <Suspense fallback={<CarouselTableSkeleton />}>
                        <CarouselTableSection
                            searchValue={searchValue}
                            onSearchChange={setSearchValue}
                            debouncedSearch={debouncedSearch}
                            sortState={sortState}
                            onSortChange={handleSortChange}
                            filterState={filterState}
                            filterActions={filterActions}
                            apiSort={apiSort}
                            cursor={cursor}
                            selection={selection}
                            onSelectionChange={setSelection}
                            onLoadMore={handleLoadMore}
                            onTotalChange={setTotal}
                            hasFilters={hasFilters}
                            onClearFilters={handleClearFilters}
                        />
                    </Suspense>
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 border-t border-border bg-background">
                    <div className="flex items-center justify-end w-full gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="brand"
                            onClick={handleSave}
                            disabled={selectedCount === 0}
                        >
                            <span>Set products</span>
                            {selectedCount > 0 && (
                                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 ml-1 rounded-sm bg-background text-[12px] leading-[12px] text-brand">
                                    {selectedCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// =============================================================================
// TABLE SECTION - Includes controls + table, uses useSuspenseQuery
// =============================================================================

interface CarouselTableSectionProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    debouncedSearch: string;
    sortState: { field: string; direction: SortDirection } | null;
    onSortChange: (sort: { field: string; direction: SortDirection } | null) => void;
    filterState: FilterState;
    filterActions: FilterActions;
    apiSort?: { field: SortField; direction: SortDirection };
    cursor?: string;
    selection: CarouselSelectionState;
    onSelectionChange: (selection: CarouselSelectionState) => void;
    onLoadMore: (cursor: string) => void;
    onTotalChange: (total: number) => void;
    hasFilters: boolean;
    onClearFilters: () => void;
}

function CarouselTableSection({
    searchValue,
    onSearchChange,
    debouncedSearch,
    sortState,
    onSortChange,
    filterState,
    filterActions,
    apiSort,
    cursor,
    selection,
    onSelectionChange,
    onLoadMore,
    onTotalChange,
    hasFilters,
    onClearFilters,
}: CarouselTableSectionProps) {
    const trpc = useTRPC();
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    // Use useSuspenseQuery - this will trigger the Suspense fallback
    const { data, isFetching } = useSuspenseQuery(
        trpc.workflow.theme.listCarouselProducts.queryOptions({
            search: debouncedSearch || undefined,
            filterState: filterState.groups.length > 0 ? filterState : undefined,
            sort: apiSort,
            cursor,
            limit: 50,
        }),
    );

    // Update total for parent component
    useEffect(() => {
        onTotalChange(data?.meta.total ?? 0);
    }, [data?.meta.total, onTotalChange]);

    const displayProducts = useMemo(() => {
        return data?.data ?? [];
    }, [data?.data]);

    const handleLoadMore = useCallback(() => {
        if (data?.meta.cursor) {
            onLoadMore(data.meta.cursor);
        }
    }, [data?.meta.cursor, onLoadMore]);

    return (
        <div className="flex flex-col">
            {/* Control bar */}
            <div className="flex items-center gap-2 mb-3">
                {/* Search */}
                <div
                    className={cn(
                        "relative flex items-center transition-all",
                        isSearchFocused ? "w-[300px]" : "w-[200px]",
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
                        aria-label="Search products"
                        placeholder="Search..."
                        className={cn(
                            "pl-8 pr-3 py-[6px] h-9",
                            "transition-all",
                            isSearchFocused ? "ring-1 ring-brand" : "ring-0",
                        )}
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                    />
                </div>

                {/* Sort */}
                <SortPopover
                    sortState={sortState}
                    onSortChange={onSortChange}
                    disabled={false}
                />

                {/* Quick Filters */}
                <QuickFiltersPopover
                    filterState={filterState}
                    filterActions={filterActions}
                    disabled={false}
                    showAdvancedFilters={false}
                />
            </div>

            {/* Table */}
            <CarouselProductsDataTable
                rows={displayProducts}
                total={data?.meta.total ?? 0}
                selection={selection}
                onSelectionChange={onSelectionChange}
                hasMore={data?.meta.hasMore ?? false}
                onLoadMore={handleLoadMore}
                isLoadingMore={isFetching && displayProducts.length > 0}
                hasFilters={hasFilters}
                onClearFilters={onClearFilters}
            />
        </div>
    );
}
