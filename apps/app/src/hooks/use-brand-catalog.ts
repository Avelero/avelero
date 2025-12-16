import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { allColors } from "@v1/selections/colors";
import { allDefaultSizes, isDefaultSize, type DefaultSize } from "@v1/selections";
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
 * SizeOption - flat size representation
 */
export interface SizeOption {
  id?: string; // DB ID (undefined = not yet in brand's DB)
  name: string; // Display name (e.g., "XL", "42", "XII")
  displayHint: number; // For ordering in popover (from default sizes or 1000+ for custom)
  isDefault: boolean; // Whether this is a default size or custom
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
      { id: string | undefined; name: string; hex: string | null }
    >();

    // Add API colors first (these have real IDs from DB)
    for (const color of apiColors) {
      const defaultColor = defaultColors.find(
        (c) => c.name.toLowerCase() === color.name.toLowerCase(),
      );
      // Priority: API hex > default color hex > null (not grey!)
      const normalizedHex =
        normalizeHex(color.hex) ?? normalizeHex(defaultColor?.hex) ?? null;
      colorMap.set(color.name.toLowerCase(), {
        id: color.id,
        name: color.name,
        hex: normalizedHex,
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
          hex: normalizeHex(color.hex) ?? null, // null if no hex, not grey
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
  // Match by NAME (not sortIndex) - brand sizes replace defaults with same name
  const sizeOptions = React.useMemo<SizeOption[]>(() => {
    const apiSizes = data?.brandCatalog.sizes ?? [];
    
    // Map brand sizes by lowercase name for matching
    const brandSizesByName = new Map(
      apiSizes.map(s => [s.name.toLowerCase(), { id: s.id, name: s.name }])
    );
    
    // Build merged list: defaults first, then custom
    const result: SizeOption[] = [];
    
    // Add defaults (replaced by brand size if name matches)
    for (const defaultSize of allDefaultSizes) {
      const brandMatch = brandSizesByName.get(defaultSize.name.toLowerCase());
      result.push({
        id: brandMatch?.id, // undefined if not in brand DB
        name: brandMatch?.name ?? defaultSize.name,
        displayHint: defaultSize.displayHint,
        isDefault: true,
      });
      // Remove from map so we know it's been matched
      if (brandMatch) {
        brandSizesByName.delete(defaultSize.name.toLowerCase());
      }
    }
    
    // Add remaining brand sizes as custom (didn't match any default)
    for (const [, brandSize] of brandSizesByName) {
      result.push({
        id: brandSize.id,
        name: brandSize.name,
        displayHint: 1000, // Custom sizes sort after defaults
        isDefault: false,
      });
    }
    
    // Sort by displayHint, then by name
    return result.sort((a, b) => {
      if (a.displayHint !== b.displayHint) {
        return a.displayHint - b.displayHint;
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
