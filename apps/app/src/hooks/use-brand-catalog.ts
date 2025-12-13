import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { allColors } from "@v1/selections/colors";
import { allDefaultSizes, type DefaultSize } from "@v1/selections";
import * as React from "react";

export interface CategoryNode {
  label: string;
  id: string;
  children?: Record<string, CategoryNode>;
}

export interface BrandTagOption {
  id: string;
  name: string;
  hex: string;
}

/**
 * SizeOption - flat size representation (no category coupling)
 */
export interface SizeOption {
  id?: string; // DB ID (undefined = not yet in brand's DB)
  name: string; // Display name (e.g., "XL", "42", "XII")
  sortIndex: number; // For ordering - UNIQUE identifier, differentiates sizes with same name in different groups
  group?: string; // Size group (e.g., "Letter", "US Numeric", "US Shoe") for UI grouping
}

/**
 * Transforms flat category list into hierarchical structure
 */
function buildCategoryHierarchy(
  categories: Array<{ id: string; name: string; parent_id: string | null }>,
): Record<string, CategoryNode> {
  const hierarchy: Record<string, CategoryNode> = {};
  const categoryMap = new Map<
    string,
    { id: string; name: string; parent_id: string | null }
  >();

  // Build map for quick lookup
  for (const category of categories) {
    categoryMap.set(category.id, category);
  }

  // Helper to build a node with its children recursively
  function buildNode(categoryId: string): CategoryNode | null {
    const category = categoryMap.get(categoryId);
    if (!category) return null;

    const node: CategoryNode = {
      label: category.name,
      id: category.id,
    };

    // Find children
    const children = categories.filter((c) => c.parent_id === categoryId);
    if (children.length > 0) {
      node.children = {};
      for (const child of children) {
        const childNode = buildNode(child.id);
        if (childNode) {
          node.children[child.id] = childNode;
        }
      }
    }

    return node;
  }

  // Find root categories (those with no parent)
  const rootCategories = categories.filter((c) => !c.parent_id);
  for (const root of rootCategories) {
    const node = buildNode(root.id);
    if (node) {
      hierarchy[root.id] = node;
    }
  }

  return hierarchy;
}

/**
 * Hook to fetch and merge brand catalog reference data.
 *
 * Consumes the prefetched `brandCatalogContent` query and merges
 * API data with client-side defaults from the selections package.
 *
 * This hook provides brand-level catalog data (categories, colors, sizes,
 * materials, operators, etc.) that can be used across the application,
 * not just in passport forms.
 *
 * @returns Merged dropdown options for brand catalog fields
 */
export function useBrandCatalog() {
  const trpc = useTRPC();

  // Access prefetched data from React Query cache
  const { data } = useSuspenseQuery(
    trpc.composite.catalogContent.queryOptions(),
  );

  // Merge colors: API colors + default colors from selections
  const colors = React.useMemo(() => {
    const apiColors = data?.brandCatalog.colors || [];
    const defaultColors = allColors;

    const normalizeHex = (hex?: string | null) => {
      if (!hex) return null;
      return hex.replace("#", "").trim().toUpperCase();
    };

    // Create a map to avoid duplicates (API colors take precedence)
    // id is undefined for default colors (not yet in brand's DB), or a real UUID for brand colors
    const colorMap = new Map<
      string,
      { id: string | undefined; name: string; hex: string }
    >();

    // Add API colors first (these have real IDs from DB)
    for (const color of apiColors) {
      const defaultColor = defaultColors.find(
        (c) => c.name.toLowerCase() === color.name.toLowerCase(),
      );
      const normalizedHex =
        normalizeHex(color.hex) ?? defaultColor?.hex ?? "000000";
      colorMap.set(color.name.toLowerCase(), {
        id: color.id,
        name: color.name,
        hex: normalizedHex.toUpperCase(),
      });
    }

    // Add default colors that aren't already in API colors
    // Default colors have id: undefined to indicate they need to be created when the product is saved
    // (NOT when selected - selection just stores them in local state as "pending")
    for (const color of defaultColors) {
      const key = color.name.toLowerCase();
      if (!colorMap.has(key)) {
        colorMap.set(key, {
          id: undefined, // Undefined = default color not yet in brand's DB
          name: color.name,
          hex: normalizeHex(color.hex) ?? "000000",
        });
      }
    }

    return Array.from(colorMap.values());
  }, [data?.brandCatalog.colors]);

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, { name: string; parentId: string | null }>();
    const rawCategories = data?.categories ?? [];
    for (const category of rawCategories) {
      map.set(category.id, {
        name: category.name,
        parentId: category.parent_id ?? null,
      });
    }
    return map;
  }, [data?.categories]);

  // Flat size options: merge brand's existing sizes with default sizes
  const sizeOptions = React.useMemo<SizeOption[]>(() => {
    const apiSizes = data?.brandCatalog.sizes ?? [];
    // Use sortIndex as unique key since same name can exist in different groups
    // (e.g., "8" in US Numeric vs "8" in US Shoe)
    const sizeMap = new Map<number, SizeOption>();

    // Helper to find the group for a given sortIndex
    const findGroupForSortIndex = (sortIndex: number): string | undefined => {
      const defaultSize = allDefaultSizes.find(s => s.sortIndex === sortIndex);
      return defaultSize?.group;
    };

    // Add brand's existing sizes first (have real DB IDs)
    for (const size of apiSizes) {
      const sortIndex = size.sort_index ?? 0;
      sizeMap.set(sortIndex, {
        id: size.id,
        name: size.name,
        sortIndex,
        group: findGroupForSortIndex(sortIndex),
      });
    }

    // Add default sizes that aren't already in brand's catalog
    for (const size of allDefaultSizes) {
      if (!sizeMap.has(size.sortIndex)) {
        sizeMap.set(size.sortIndex, {
          id: undefined, // Not in DB yet
          name: size.name,
          sortIndex: size.sortIndex,
          group: size.group,
        });
      }
    }

    // Sort by sortIndex, then by name
    return Array.from(sizeMap.values()).sort((a, b) => {
      if (a.sortIndex !== b.sortIndex) {
        return a.sortIndex - b.sortIndex;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [data?.brandCatalog.sizes]);

  // Build category hierarchy for CategorySelect component
  const categoryHierarchy = React.useMemo(() => {
    return buildCategoryHierarchy(data?.categories || []);
  }, [data?.categories]);

  const tags = React.useMemo<BrandTagOption[]>(() => {
    const apiTags = data?.brandCatalog.tags ?? [];
    return apiTags.map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      hex: (tag.hex ?? "000000").toUpperCase(),
    }));
  }, [data?.brandCatalog.tags]);

  return {
    // System-level (no merging needed)
    categories: data?.categories || [],
    categoryHierarchy,
    categoryMap,

    // Brand catalog (API only, no defaults)
    materials: data?.brandCatalog.materials || [],
    operators: data?.brandCatalog.operators || [], // Facilities/production plants from brand_facilities table
    certifications: data?.brandCatalog.certifications || [],
    manufacturers: data?.brandCatalog.manufacturers || [], // Manufacturers from brand_manufacturers table
    seasons: (data?.brandCatalog.seasons || []).map((s: any) => ({
      id: s.id ?? "",
      name: s.name,
      startDate: s.startDate ? new Date(s.startDate) : undefined,
      endDate: s.endDate ? new Date(s.endDate) : undefined,
      isOngoing: s.ongoing,
    })),

    // Merged with defaults
    colors,
    sizeOptions,
    tags,
  };
}

// Backwards compatibility alias
export const usePassportFormData = useBrandCatalog;
