"use client";

import { useFilterState } from "@/hooks/use-filter-state";
import { useUserQuerySuspense } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import {
  Suspense,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
} from "react";
import { PassportDataTable, PassportTableSkeleton } from "../tables/passports";
import type {
  PassportTableRow,
  SelectionState,
} from "../tables/passports/types";
import type { FilterState } from "./filter-types";
import { PassportControls } from "./passport-controls";

type SortField =
  | "name"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "category"
  | "season"
  | "productIdentifier";

export function TableSection() {
  const [selectedCount, setSelectedCount] = useState(0);
  const [selection, setSelection] = useState<SelectionState>({
    mode: "explicit",
    includeIds: [],
    excludeIds: [],
  });
  const [hasAnyPassports, setHasAnyPassports] = useState(false);
  // Filter state management
  const [filterState, filterActions] = useFilterState();

  // Search state management (debounced)
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue);

  // Sort state management (UI only for now)
  const [sortState, setSortState] = useState<{
    field: string;
    direction: "asc" | "desc";
  } | null>(null);

  // Column preferences state (excludes locked `product` and fixed `actions`)
  const DEFAULT_VISIBLE: string[] = useMemo(
    () => ["status", "category", "season", "variantCount"],
    [],
  );

  const userQuery = useUserQuerySuspense();
  const brandId = (userQuery.data as any)?.brand_id as
    | string
    | null
    | undefined;
  const userId = (userQuery.data as any)?.id as string | null | undefined;

  const buildCookieKeys = useCallback(() => {
    const base = "avelero.passports.columns.v1";
    const keys: string[] = [];
    if (brandId && userId) keys.push(`${base}:${brandId}:${userId}`);
    if (brandId) keys.push(`${base}:${brandId}`);
    if (userId) keys.push(`${base}::user:${userId}`);
    keys.push(base);
    return keys;
  }, [brandId, userId]);

  const readCookie = useCallback((): string[] | null => {
    if (typeof document === "undefined") return null;
    const keys = buildCookieKeys();
    for (const key of keys) {
      const match = document.cookie
        ?.split("; ")
        .find((row) => row.startsWith(`${key}=`));
      if (match) {
        try {
          const val = decodeURIComponent(match.split("=")[1] ?? "");
          const parsed = JSON.parse(val) as { visible?: string[] } | string[];
          if (Array.isArray(parsed)) return parsed;
          if (parsed && Array.isArray(parsed.visible)) return parsed.visible;
        } catch {}
      }
    }
    return null;
  }, [buildCookieKeys]);

  const writeCookie = useCallback(
    (visible: string[], scope: "specific" | "brand" | "user" | "global") => {
      if (typeof document === "undefined") return;
      const base = "avelero.passports.columns.v1";
      let key = base;
      if (scope === "specific" && brandId && userId)
        key = `${base}:${brandId}:${userId}`;
      else if (scope === "brand" && brandId) key = `${base}:${brandId}`;
      else if (scope === "user" && userId) key = `${base}::user:${userId}`;
      const value = encodeURIComponent(JSON.stringify({ visible }));
      const maxAge = 60 * 60 * 24 * 365; // 365 days
      document.cookie = `${key}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure`;
    },
    [brandId, userId],
  );

  const deleteCookie = useCallback((key: string) => {
    if (typeof document === "undefined") return;
    document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
  }, []);

  const migrateIfNeeded = useCallback(
    (visible: string[] | null) => {
      if (!visible) return;
      if (brandId && userId) {
        const base = "avelero.passports.columns.v1";
        const specific = `${base}:${brandId}:${userId}`;
        const brandOnly = `${base}:${brandId}`;
        const userOnly = `${base}::user:${userId}`;
        const global = base;
        // If specific not present but broader exists, migrate
        const existingSpecific = document.cookie
          ?.split("; ")
          .some((r) => r.startsWith(`${specific}=`));
        if (!existingSpecific) {
          writeCookie(visible, "specific");
          // remove broader ones
          for (const k of [brandOnly, userOnly, global]) deleteCookie(k);
        }
      }
    },
    [brandId, userId, writeCookie, deleteCookie],
  );

  const [visibleColumns, setVisibleColumns] =
    useState<string[]>(DEFAULT_VISIBLE);

  useEffect(() => {
    const saved = readCookie();
    if (saved?.length) {
      setVisibleColumns(saved);
      migrateIfNeeded(saved);
    } else {
      setVisibleColumns(DEFAULT_VISIBLE);
    }
  }, [readCookie, migrateIfNeeded, DEFAULT_VISIBLE]);

  const handleSavePrefs = useCallback(
    (nextVisible: string[]) => {
      setVisibleColumns(nextVisible);
      if (brandId && userId) writeCookie(nextVisible, "specific");
      else if (brandId) writeCookie(nextVisible, "brand");
      else if (userId) writeCookie(nextVisible, "user");
      else writeCookie(nextVisible, "global");
    },
    [brandId, userId, writeCookie],
  );

  // Compute table state from visible
  const columnOrder = useMemo(() => {
    return ["product", ...visibleColumns, "actions"];
  }, [visibleColumns]);

  const columnVisibility = useMemo(() => {
    const all: Record<string, boolean> = {
      product: true,
      status: false,
      category: false,
      season: false,
      variantCount: false,
    };
    for (const id of visibleColumns) all[id] = true;
    return all;
  }, [visibleColumns]);

  const allCustomizable = useMemo(
    () => [
      { id: "status", label: "Status" },
      { id: "category", label: "Category" },
      { id: "season", label: "Season" },
      { id: "variantCount", label: "Variants" },
    ],
    [],
  );

  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const pageSize = 50;
  const [isInnerSuspenseEnabled, setIsInnerSuspenseEnabled] = useState(false);

  useEffect(() => {
    setIsInnerSuspenseEnabled(true);
  }, []);

  // Check if there are active filters or search
  const hasActiveFilters = useMemo(() => {
    const hasSearch = deferredSearch.trim().length > 0;
    const hasFilterGroups = filterState.groups.length > 0;
    return hasSearch || hasFilterGroups;
  }, [deferredSearch, filterState.groups]);

  const handleClearFilters = useCallback(() => {
    setSearchValue("");
    filterActions.clearAll();
  }, [filterActions]);

  // Map UI field names to API field names
  const mapSortField = useCallback((uiField: string): SortField => {
    const fieldMap: Record<string, SortField> = {
      title: "name",
      productIdentifier: "productIdentifier",
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
        displayProps={{
          productLabel: "Product",
          allColumns: allCustomizable,
          initialVisible: visibleColumns,
          onSave: handleSavePrefs,
        }}
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
}: TableContentProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
      filters: filterState.groups.length > 0 ? filterState : undefined,
      search: search?.trim() || undefined,
      sort: sort,
    }),
  );

  const tableRows = useMemo<PassportTableRow[]>(() => {
    const list = productsResponse?.data ?? [];
    return list.map((p: any) => {
      const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
      const colorSet = new Set<string>();
      const sizeSet = new Set<string>();
      for (const v of variants) {
        const c = (v.color_id ?? v.colorId ?? "").toString();
        const s = (v.size_id ?? v.sizeId ?? "").toString();
        if (c) colorSet.add(c);
        if (s) sizeSet.add(s);
      }
      return {
        id: p.id,
        passportIds: [p.id],
        productUpid: p.upid ?? "",
        name: p.name ?? "",
        productIdentifier: p.product_identifier ?? p.productIdentifier ?? "",
        status: (p.status ?? "unpublished") as any,
        category: (p as any).category_name ?? null,
        categoryPath: (p as any).category_path ?? null,
        season: (p as any).season_name ?? null,
        primaryImageUrl: p.primary_image_url ?? p.primaryImageUrl ?? null,
        variantCount: variants.length || undefined,
        createdAt: p.created_at ?? p.createdAt ?? "",
        updatedAt: p.updated_at ?? p.updatedAt ?? "",
      } satisfies PassportTableRow;
    });
  }, [productsResponse]);

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
    />
  );
}
