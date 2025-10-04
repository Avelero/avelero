"use client";

import { useFilterState } from "@/hooks/use-filter-state";
import { useSortState } from "@/hooks/use-sort-state";
import { useUserQuerySuspense } from "@/hooks/use-user";
import * as React from "react";
import { PassportDataTable } from "../tables/passports";
import type { SelectionState } from "../tables/passports/types";
import { PassportControls } from "./passport-controls";

export function TableSection() {
  const [selectedCount, setSelectedCount] = React.useState(0);
  const [selection, setSelection] = React.useState<SelectionState>({
    mode: "explicit",
    includeIds: [],
    excludeIds: [],
  });
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const [hasAnyPassports, setHasAnyPassports] = React.useState(true);

  // Filter state management
  const [filterState, filterActions] = useFilterState();
  
  // Sort state management
  const [sortState, sortActions] = useSortState();
  // Column preferences state (excludes locked `product` and fixed `actions`)
  const DEFAULT_VISIBLE: string[] = React.useMemo(
    () => ["status", "completion", "category", "season", "template"],
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
      actions: true,
      status: false,
      completion: false,
      category: false,
      color: false,
      size: false,
      season: false,
      template: false,
    };
    for (const id of visibleColumns) all[id] = true;
    return all;
  }, [visibleColumns]);

  const allCustomizable = React.useMemo(
    () => [
      { id: "status", label: "Status" },
      { id: "completion", label: "Completion" },
      { id: "category", label: "Category" },
      { id: "color", label: "Color" },
      { id: "size", label: "Size" },
      { id: "season", label: "Season" },
      { id: "template", label: "Template" },
    ],
    [],
  );
  return (
    <div className="w-full">
      <PassportControls
        selectedCount={selectedCount}
        disabled={false}
        selection={selection}
        onClearSelectionAction={() => {
          setSelection({ mode: "explicit", includeIds: [], excludeIds: [] });
          setSelectionVersion((v) => v + 1);
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
        sortActions={sortActions}
      />
      <PassportDataTable
        onTotalCountChangeAction={setHasAnyPassports}
        onSelectionChangeAction={setSelectedCount}
        selection={selection}
        onSelectionStateChangeAction={setSelection}
        sortState={sortState}
        // bump key to force internal rowSelection recompute after clearing
        key={`passports-table-${selectionVersion}`}
        columnOrder={columnOrder}
        columnVisibility={columnVisibility}
        filterState={filterState}
      />
    </div>
  );
}
