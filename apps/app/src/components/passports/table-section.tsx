"use client";

import { useFilterState } from "@/hooks/use-filter-state";
import { useUserQuerySuspense } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { PassportDataTable } from "../tables/passports";
import type { PassportTableRow, SelectionState } from "../tables/passports/types";
import { PassportControls } from "./passport-controls";

export function TableSection() {
  const [selectedCount, setSelectedCount] = React.useState(0);
  const [selection, setSelection] = React.useState<SelectionState>({
    mode: "explicit",
    includeIds: [],
    excludeIds: [],
  });
  const [hasAnyPassports, setHasAnyPassports] = React.useState(true);
  const trpc = useTRPC();

  // Filter state management
  const [filterState, filterActions] = useFilterState();

  // Sort state management (UI only for now)
  const [sortState, setSortState] = React.useState<{
    field: string;
    direction: "asc" | "desc";
  } | null>(null);

  // Column preferences state (excludes locked `product` and fixed `actions`)
  const DEFAULT_VISIBLE: string[] = React.useMemo(
    () => ["status", "category", "season", "variantCount"],
    [],
  );

  const userQuery = useUserQuerySuspense();
  const brandId = (userQuery.data as any)?.brand_id as
    | string
    | null
    | undefined;
  const userId = (userQuery.data as any)?.id as string | null | undefined;

  const buildCookieKeys = React.useCallback(() => {
    const base = "avelero.passports.columns.v1";
    const keys: string[] = [];
    if (brandId && userId) keys.push(`${base}:${brandId}:${userId}`);
    if (brandId) keys.push(`${base}:${brandId}`);
    if (userId) keys.push(`${base}::user:${userId}`);
    keys.push(base);
    return keys;
  }, [brandId, userId]);

  const readCookie = React.useCallback((): string[] | null => {
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

  const writeCookie = React.useCallback(
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

  const deleteCookie = React.useCallback((key: string) => {
    if (typeof document === "undefined") return;
    document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
  }, []);

  const migrateIfNeeded = React.useCallback(
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
    React.useState<string[]>(DEFAULT_VISIBLE);

  React.useEffect(() => {
    const saved = readCookie();
    if (saved?.length) {
      setVisibleColumns(saved);
      migrateIfNeeded(saved);
    } else {
      setVisibleColumns(DEFAULT_VISIBLE);
    }
  }, [readCookie, migrateIfNeeded, DEFAULT_VISIBLE]);

  const handleSavePrefs = React.useCallback(
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
  const columnOrder = React.useMemo(() => {
    return ["product", ...visibleColumns, "actions"];
  }, [visibleColumns]);

  const columnVisibility = React.useMemo(() => {
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

  const allCustomizable = React.useMemo(
    () => [
      { id: "status", label: "Status" },
      { id: "category", label: "Category" },
      { id: "season", label: "Season" },
      { id: "variantCount", label: "Variants" },
    ],
    [],
  );

  const [cursorStack, setCursorStack] = React.useState<string[]>([]);
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const pageSize = 50;

  const { data: productsResponse, isLoading } = useQuery(
    trpc.products.list.queryOptions({
      cursor,
      limit: pageSize,
      includeVariants: true,
    }),
  );

  const tableRows = React.useMemo<PassportTableRow[]>(() => {
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
        categoryPath: null,
        season:
          (p as any).season_name ??
          (p as any).season ??
          (p as any).seasonId ??
          null,
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
  const handleNextPage = React.useCallback(() => {
    if (!meta?.cursor && !meta?.hasMore) return;
    setCursorStack((prev) => [...prev, cursor ?? ""]);
    setCursor(meta?.cursor ?? undefined);
  }, [meta?.cursor, meta?.hasMore, cursor]);

  const handlePrevPage = React.useCallback(() => {
      setCursorStack((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        const last = next.pop();
        setCursor(last?.length ? last : undefined);
        return next;
      });
  }, []);

  const handleFirstPage = React.useCallback(() => {
    setCursorStack([]);
    setCursor(undefined);
  }, []);

  const handleLastPage = React.useCallback(() => {
    const targetIndex = lastPageIndex;
    if (targetIndex <= 0) {
      setCursorStack([]);
      setCursor(undefined);
      return;
    }

    const stack = Array.from({ length: targetIndex }, (_, i) =>
      i === 0 ? "" : String(i * pageSize),
    );
    setCursorStack(stack);
    setCursor(String(targetIndex * pageSize));
  }, [lastPageIndex, pageSize]);

  const pageStart =
    totalRows === 0 ? 0 : cursorStack.length * pageSize + (tableRows.length ? 1 : 0);
  const pageEnd = cursorStack.length * pageSize + tableRows.length;
  return (
    <div className="w-full">
      <PassportControls
        selectedCount={selectedCount}
        disabled={!hasAnyPassports}
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
      />
      <PassportDataTable
        onTotalCountChangeAction={setHasAnyPassports}
        onSelectionChangeAction={setSelectedCount}
        selection={selection}
        onSelectionStateChangeAction={setSelection}
        columnOrder={columnOrder}
        columnVisibility={columnVisibility}
        rows={tableRows}
        total={totalRows}
        isLoading={isLoading}
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
      />
    </div>
  );
}
