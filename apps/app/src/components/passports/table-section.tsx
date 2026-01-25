"use client";

import { useDebounce } from "@/hooks/use-debounce";
import { useFilterState } from "@/hooks/use-filter-state";
import { useUserQuerySuspense } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "@v1/ui/sonner";
import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DeleteProductsModal } from "../modals/delete-products-modal";
import { PassportDataTable, PassportTableSkeleton } from "../tables/passports";
import type {
  PassportStatus,
  PassportTableRow,
  SelectionState,
} from "../tables/passports/types";
import type { FilterState } from "./filter-types";
import { PassportControls } from "./passport-controls";
import { useSelectionContextSafe } from "./selection-context";

type SortField =
  | "name"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "category"
  | "season"
  | "productHandle";

export function TableSection() {
  const [selectedCount, setSelectedCount] = useState(0);
  const [selection, setSelection] = useState<SelectionState>({
    mode: "explicit",
    includeIds: [],
    excludeIds: [],
  });
  const [hasAnyPassports, setHasAnyPassports] = useState(false);
  const [visibleProductIds, setVisibleProductIds] = useState<string[]>([]);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  // Selection state used specifically for the delete modal (can be the main selection or a single product)
  const [deleteSelection, setDeleteSelection] = useState<SelectionState>({
    mode: "explicit",
    includeIds: [],
    excludeIds: [],
  });
  // Count for delete modal (resolved from selection or passed directly for single delete)
  const [deleteCount, setDeleteCount] = useState(0);

  // Status change mutation
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const updateProductMutation = useMutation(
    trpc.products.update.mutationOptions({
      onSuccess: () => {
        // Invalidate products list to refresh table
        void queryClient.invalidateQueries({
          queryKey: [["products", "list"]],
        });
        void queryClient.invalidateQueries({ queryKey: [["summary"]] });
      },
    }),
  );

  // Filter state management
  const [filterState, filterActions] = useFilterState();

  // Search state management (debounced)
  // First debounce by 300ms, then use React's deferred value for smooth rendering
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebounce(searchValue, 300);
  const deferredSearch = useDeferredValue(debouncedSearch);

  // Sort state management (UI only for now)
  const [sortState, setSortState] = useState<{
    field: string;
    direction: "asc" | "desc";
  } | null>(null);

  const userQuery = useUserQuerySuspense();
  const brandId = (userQuery.data as any)?.brand_id as
    | string
    | null
    | undefined;

  // Static column order - all columns always visible
  const columnOrder = useMemo(
    () => [
      "product",
      "status",
      "category",
      "season",
      "variantCount",
      "barcodeCoverage",
      "tags",
      "actions",
    ],
    [],
  );

  const columnVisibility = useMemo(
    () => ({
      product: true,
      status: true,
      category: true,
      season: true,
      variantCount: true,
      barcodeCoverage: true,
      tags: true,
      actions: true,
    }),
    [],
  );

  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const pageSize = 50;
  const [isInnerSuspenseEnabled, setIsInnerSuspenseEnabled] = useState(false);

  useEffect(() => {
    setIsInnerSuspenseEnabled(true);
  }, []);

  // Check if there are active filters or search (defined before useEffect that uses it)
  const hasActiveFilters = useMemo(() => {
    const hasSearch = deferredSearch.trim().length > 0;
    const hasFilterGroups = filterState.groups.length > 0;
    return hasSearch || hasFilterGroups;
  }, [deferredSearch, filterState.groups]);

  // Sync selection state to context (for Export button in layout)
  const selectionContext = useSelectionContextSafe();
  useEffect(() => {
    if (selectionContext) {
      selectionContext.setSelection(selection);
      selectionContext.setSelectedCount(selectedCount);
      selectionContext.setFilterState(filterState);
      selectionContext.setSearchValue(searchValue);
      selectionContext.setDisabled(!hasAnyPassports && !hasActiveFilters);
    }
  }, [
    selection,
    selectedCount,
    filterState,
    searchValue,
    hasAnyPassports,
    hasActiveFilters,
    selectionContext,
  ]);

  const handleClearFilters = useCallback(() => {
    setSearchValue("");
    filterActions.clearAll();
  }, [filterActions]);

  // Handle delete from row action (single product)
  const handleDeleteProduct = useCallback((productId: string) => {
    // Create a temporary explicit selection with just this product
    setDeleteSelection({
      mode: "explicit",
      includeIds: [productId],
      excludeIds: [],
    });
    setDeleteCount(1);
    setDeleteModalOpen(true);
  }, []);

  // Handle bulk delete from Actions button
  const handleDeleteSelected = useCallback(() => {
    if (selectedCount > 0) {
      // Pass the current selection state directly to the modal
      setDeleteSelection(selection);
      setDeleteCount(selectedCount);
      setDeleteModalOpen(true);
    }
  }, [selection, selectedCount]);

  // Clear selection after successful delete
  const handleDeleteSuccess = useCallback(() => {
    setSelection({ mode: "explicit", includeIds: [], excludeIds: [] });
    setDeleteSelection({ mode: "explicit", includeIds: [], excludeIds: [] });
    setDeleteCount(0);
  }, []);

  // Handle status change from row action (single product)
  const handleChangeStatus = useCallback(
    (productId: string, status: "published" | "unpublished") => {
      updateProductMutation.mutate(
        { id: productId, status },
        {
          onSuccess: () => {
            toast.success(
              `Product ${status === "published" ? "published" : "unpublished"} successfully`,
            );
          },
          onError: (error) => {
            toast.error(error.message || "Failed to update product status");
          },
        },
      );
    },
    [updateProductMutation],
  );

  // Handle bulk status change from Actions menu
  const handleChangeStatusSelected = useCallback(
    (status: "published" | "unpublished" | "scheduled") => {
      if (selectedCount === 0) {
        toast.error("No products selected");
        return;
      }

      // Build selection for bulk update
      const bulkSelection =
        selection.mode === "explicit"
          ? { mode: "explicit" as const, includeIds: selection.includeIds }
          : {
              mode: "all" as const,
              excludeIds: selection.excludeIds,
              filters: filterState.groups.length > 0 ? filterState : undefined,
              search: searchValue?.trim() || undefined,
            };

      updateProductMutation.mutate(
        { selection: bulkSelection, status },
        {
          onSuccess: () => {
            const statusLabel =
              status === "published"
                ? "published"
                : status === "scheduled"
                  ? "scheduled"
                  : "unpublished";
            toast.success(
              `${selectedCount} ${selectedCount === 1 ? "product" : "products"} ${statusLabel} successfully`,
            );
            // Clear selection after bulk operation
            setSelection({ mode: "explicit", includeIds: [], excludeIds: [] });
          },
          onError: (error) => {
            toast.error(error.message || "Failed to update product status");
          },
        },
      );
    },
    [selection, selectedCount, filterState, searchValue, updateProductMutation],
  );

  // Map UI field names to API field names
  const mapSortField = useCallback((uiField: string): SortField => {
    const fieldMap: Record<string, SortField> = {
      title: "name",
      productHandle: "productHandle",
      status: "status",
      category: "category",
      season: "season",
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    };
    return fieldMap[uiField] ?? "createdAt";
  }, []);

  // Memoize the sort object to prevent infinite loops
  const mappedSort = useMemo(() => {
    if (!sortState) return undefined;
    return {
      field: mapSortField(sortState.field),
      direction: sortState.direction,
    };
  }, [sortState, mapSortField]);

  const tableContent = (
    <TableContent
      columnOrder={columnOrder}
      columnVisibility={columnVisibility}
      cursor={cursor}
      cursorStack={cursorStack}
      onCursorChange={setCursor}
      onCursorStackChange={setCursorStack}
      onSelectionChangeAction={setSelectedCount}
      onSelectionStateChangeAction={setSelection}
      onTotalCountChangeAction={setHasAnyPassports}
      pageSize={pageSize}
      selection={selection}
      search={deferredSearch}
      sort={mappedSort}
      filterState={filterState}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClearFilters}
      onDeleteProduct={handleDeleteProduct}
      onChangeStatus={handleChangeStatus}
      onVisibleProductIdsChange={setVisibleProductIds}
    />
  );

  return (
    <div className="w-full">
      <PassportControls
        selectedCount={selectedCount}
        disabled={!hasAnyPassports && !hasActiveFilters}
        selection={selection}
        onClearSelectionAction={() => {
          setSelection({ mode: "explicit", includeIds: [], excludeIds: [] });
        }}
        onDeleteSelectedAction={handleDeleteSelected}
        onChangeStatusSelectedAction={handleChangeStatusSelected}
        filterState={filterState}
        filterActions={filterActions}
        sortState={sortState}
        onSortChange={setSortState}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />
      {isInnerSuspenseEnabled ? (
        <Suspense
          fallback={
            <PassportTableSkeleton
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
            />
          }
        >
          {tableContent}
        </Suspense>
      ) : (
        tableContent
      )}

      {/* Delete Products Modal */}
      <DeleteProductsModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        selection={deleteSelection}
        filterState={filterState}
        search={deferredSearch}
        totalCount={deleteCount}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

interface TableContentProps {
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  cursor: string | undefined;
  cursorStack: string[];
  onCursorChange: React.Dispatch<React.SetStateAction<string | undefined>>;
  onCursorStackChange: React.Dispatch<React.SetStateAction<string[]>>;
  onSelectionChangeAction: (count: number) => void;
  onSelectionStateChangeAction: (next: SelectionState) => void;
  onTotalCountChangeAction: (hasAny: boolean) => void;
  pageSize: number;
  selection: SelectionState;
  search?: string;
  sort?: { field: SortField; direction: "asc" | "desc" };
  filterState: FilterState;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onDeleteProduct?: (productId: string) => void;
  onChangeStatus?: (
    productId: string,
    status: "published" | "unpublished",
  ) => void;
  onVisibleProductIdsChange?: (ids: string[]) => void;
}

function TableContent({
  columnOrder,
  columnVisibility,
  cursor,
  cursorStack,
  onCursorChange,
  onCursorStackChange,
  onSelectionChangeAction,
  onSelectionStateChangeAction,
  onTotalCountChangeAction,
  pageSize,
  selection,
  search,
  sort,
  filterState,
  hasActiveFilters = false,
  onClearFilters,
  onDeleteProduct,
  onChangeStatus,
  onVisibleProductIdsChange,
}: TableContentProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get user data for brand context
  const { data: userResult } = useUserQuerySuspense();

  // Track previous values to detect changes (including clearing)
  const prevSearchRef = useRef<string | undefined>(search);
  const prevSortRef = useRef<
    { field: SortField; direction: "asc" | "desc" } | undefined
  >(sort);
  const prevFiltersRef = useRef<string>(JSON.stringify(filterState.groups));

  // Reset to first page when search changes (including clearing)
  useEffect(() => {
    const currentSearch = search ?? "";
    const prevSearch = prevSearchRef.current ?? "";

    if (currentSearch !== prevSearch) {
      onCursorStackChange([]);
      onCursorChange(undefined);
      prevSearchRef.current = search;
    }
  }, [search, onCursorChange, onCursorStackChange]);

  // Reset to first page when sort changes (including clearing)
  useEffect(() => {
    const currentSort = sort ? `${sort.field}:${sort.direction}` : "";
    const prevSort = prevSortRef.current
      ? `${prevSortRef.current.field}:${prevSortRef.current.direction}`
      : "";

    if (currentSort !== prevSort) {
      onCursorStackChange([]);
      onCursorChange(undefined);
      prevSortRef.current = sort;
    }
  }, [sort, onCursorChange, onCursorStackChange]);

  // Reset to first page when filters change (including clearing)
  // Serialize filterState to detect content changes, not just group count changes
  const serializedFilters = useMemo(
    () => JSON.stringify(filterState.groups),
    [filterState.groups],
  );

  useEffect(() => {
    const prevFilters = prevFiltersRef.current;

    if (serializedFilters !== prevFilters) {
      onCursorStackChange([]);
      onCursorChange(undefined);
      prevFiltersRef.current = serializedFilters;
    }
  }, [serializedFilters, onCursorChange, onCursorStackChange]);

  const { data: productsResponse } = useSuspenseQuery(
    trpc.products.list.queryOptions({
      cursor,
      limit: pageSize,
      includeVariants: true,
      includeAttributes: true,
      filters: filterState.groups.length > 0 ? filterState : undefined,
      search: search?.trim() || undefined,
      sort: sort,
    }),
  );

  const tableRows = useMemo<PassportTableRow[]>(() => {
    const list = productsResponse?.data ?? [];
    return list.map((p: any) => {
      const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
      const attributes = p.attributes ?? {};
      const tags = Array.isArray(attributes.tags) ? attributes.tags : [];

      // Filter out ghost variants using the explicit isGhost flag.
      // Ghost variants exist for publishing purposes but should be invisible to users.
      const visibleVariants = variants.filter((v: any) => !v.isGhost);

      return {
        id: p.id,
        passportIds: [p.id],
        name: p.name ?? "",
        productHandle: p.product_handle ?? p.productHandle ?? "",
        status: (p.status ?? "unpublished") as PassportStatus,
        firstVariantUpid: p.first_variant_upid ?? null,
        category: (p as any).category_name ?? null,
        categoryPath: (p as any).category_path ?? null,
        season: (p as any).season_name ?? null,
        imagePath: p.image_path ?? (p as any).imagePath ?? null,
        createdAt: p.created_at ?? p.createdAt ?? "",
        updatedAt: p.updated_at ?? p.updatedAt ?? "",
        variantCount: visibleVariants.length,
        variantsWithBarcode: p.variants_with_barcode ?? 0,
        tags: tags.map((t: any) => ({
          id: t.id ?? t.tag_id ?? "",
          name: t.name ?? null,
          hex: t.hex ?? null,
        })),
      } satisfies PassportTableRow;
    });
  }, [productsResponse]);

  // Report visible product IDs to parent for bulk operations
  useEffect(() => {
    if (onVisibleProductIdsChange) {
      const ids = tableRows.map((row) => row.id);
      onVisibleProductIdsChange(ids);
    }
  }, [tableRows, onVisibleProductIdsChange]);

  const meta = (productsResponse as any)?.meta ?? {};
  const totalRows =
    typeof meta.total === "number"
      ? meta.total
      : Array.isArray(productsResponse?.data)
        ? productsResponse?.data.length
        : 0;
  const hasNext = Boolean(meta.hasMore);
  const pageIndex = cursorStack.length;
  const lastPageIndex =
    totalRows > 0 ? Math.max(0, Math.ceil(totalRows / pageSize) - 1) : 0;

  const handleNextPage = useCallback(() => {
    if (!meta?.cursor && !meta?.hasMore) return;
    onCursorStackChange((prev) => [...prev, cursor ?? ""]);
    onCursorChange(meta?.cursor ?? undefined);
  }, [
    cursor,
    meta?.cursor,
    meta?.hasMore,
    onCursorChange,
    onCursorStackChange,
  ]);

  const handlePrevPage = useCallback(() => {
    onCursorStackChange((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = next.pop();
      onCursorChange(last?.length ? last : undefined);
      return next;
    });
  }, [onCursorChange, onCursorStackChange]);

  const handleFirstPage = useCallback(() => {
    onCursorStackChange([]);
    onCursorChange(undefined);
  }, [onCursorChange, onCursorStackChange]);

  const handleLastPage = useCallback(() => {
    const targetIndex = lastPageIndex;
    if (targetIndex <= 0) {
      onCursorStackChange([]);
      onCursorChange(undefined);
      return;
    }

    const stack = Array.from({ length: targetIndex }, (_, i) =>
      i === 0 ? "" : String(i * pageSize),
    );
    onCursorStackChange(stack);
    onCursorChange(String(targetIndex * pageSize));
  }, [lastPageIndex, onCursorChange, onCursorStackChange, pageSize]);

  // Prefetch handlers for hover prefetching
  const handlePrefetchNext = useCallback(() => {
    if (!meta?.cursor && !meta?.hasMore) return;
    void queryClient.prefetchQuery(
      trpc.products.list.queryOptions({
        cursor: meta?.cursor ?? undefined,
        limit: pageSize,
        includeVariants: true,
        includeAttributes: true,
        filters: filterState.groups.length > 0 ? filterState : undefined,
        search: search?.trim() || undefined,
        sort: sort,
      }),
    );
  }, [
    queryClient,
    trpc,
    meta?.cursor,
    meta?.hasMore,
    pageSize,
    search,
    sort,
    filterState,
  ]);

  const handlePrefetchPrev = useCallback(() => {
    if (!cursorStack.length) return;
    const prevCursor = cursorStack[cursorStack.length - 1] || undefined;
    void queryClient.prefetchQuery(
      trpc.products.list.queryOptions({
        cursor: prevCursor,
        limit: pageSize,
        includeVariants: true,
        includeAttributes: true,
        filters: filterState.groups.length > 0 ? filterState : undefined,
        search: search?.trim() || undefined,
        sort: sort,
      }),
    );
  }, [queryClient, trpc, cursorStack, pageSize, search, sort, filterState]);

  const handlePrefetchFirst = useCallback(() => {
    void queryClient.prefetchQuery(
      trpc.products.list.queryOptions({
        cursor: undefined,
        limit: pageSize,
        includeVariants: true,
        includeAttributes: true,
        filters: filterState.groups.length > 0 ? filterState : undefined,
        search: search?.trim() || undefined,
        sort: sort,
      }),
    );
  }, [queryClient, trpc, pageSize, search, sort, filterState]);

  const handlePrefetchLast = useCallback(() => {
    const targetIndex = lastPageIndex;
    if (targetIndex <= 0) {
      handlePrefetchFirst();
      return;
    }
    const lastCursor = String(targetIndex * pageSize);
    void queryClient.prefetchQuery(
      trpc.products.list.queryOptions({
        cursor: lastCursor,
        limit: pageSize,
        includeVariants: true,
        includeAttributes: true,
        filters: filterState.groups.length > 0 ? filterState : undefined,
        search: search?.trim() || undefined,
        sort: sort,
      }),
    );
  }, [
    queryClient,
    trpc,
    lastPageIndex,
    pageSize,
    handlePrefetchFirst,
    search,
    sort,
    filterState,
  ]);

  const pageStart =
    totalRows === 0
      ? 0
      : cursorStack.length * pageSize + (tableRows.length ? 1 : 0);
  const pageEnd = cursorStack.length * pageSize + tableRows.length;

  // Track if there are truly no products (not filtered)
  // If filters are active and we have 0 results, it means products exist but don't match filters
  // Only set hasAnyPassports to false if there are no products AND no active filters
  useEffect(() => {
    if (totalRows > 0) {
      // We have products
      onTotalCountChangeAction(true);
    } else if (hasActiveFilters) {
      // Filters are active but no results - means products exist, just don't match
      onTotalCountChangeAction(true);
    } else {
      // No products and no filters - truly no products
      onTotalCountChangeAction(false);
    }
  }, [totalRows, hasActiveFilters, onTotalCountChangeAction]);

  return (
    <PassportDataTable
      onTotalCountChangeAction={onTotalCountChangeAction}
      onSelectionChangeAction={onSelectionChangeAction}
      selection={selection}
      onSelectionStateChangeAction={onSelectionStateChangeAction}
      columnOrder={columnOrder}
      columnVisibility={columnVisibility}
      rows={tableRows}
      total={totalRows}
      pageInfo={{
        hasNext,
        hasPrev: cursorStack.length > 0,
        hasFirst: pageIndex > 0,
        hasLast: pageIndex < lastPageIndex,
        start: pageStart,
        end: pageEnd,
      }}
      onNextPage={handleNextPage}
      onPrevPage={handlePrevPage}
      onFirstPage={handleFirstPage}
      onLastPage={handleLastPage}
      onPrefetchNext={handlePrefetchNext}
      onPrefetchPrev={handlePrefetchPrev}
      onPrefetchFirst={handlePrefetchFirst}
      onPrefetchLast={handlePrefetchLast}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      onDeleteProduct={onDeleteProduct}
      onChangeStatus={onChangeStatus}
    />
  );
}
