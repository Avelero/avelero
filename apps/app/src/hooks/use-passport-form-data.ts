import type { TierTwoSizeOption } from "@/components/select/size-select";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { allColors } from "@v1/selections/colors";
import * as React from "react";

export interface CategoryNode {
  label: string;
  id: string;
  children?: Record<string, CategoryNode>;
}

export interface TierTwoCategoryInfo {
  key: string;
  displayName: string;
}

/**
 * Helper: Extract level 2 category key from full category path
 * Examples:
 *   "Men's / Tops / Jerseys" -> "mens-tops"
 *   "Women's / Bottoms" -> "womens-bottoms"
 *   "Men's" -> null (not level 2)
 */
export function getCategoryKey(categoryPath: string): string | null {
  if (!categoryPath || categoryPath === "Select category") {
    return null;
  }

  const parts = categoryPath.split(" / ").map((p) => p.trim());

  // Need at least 2 levels
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  // Convert to kebab-case key (e.g., "Men's" -> "mens", "Tops" -> "tops")
  const level1 = parts[0].toLowerCase().replace(/[']/g, "");
  const level2 = parts[1].toLowerCase().replace(/[']/g, "");

  return `${level1}-${level2}`;
}

/**
 * Transforms flat category list into hierarchical structure
 */
function buildCategoryHierarchy(categories: Array<{ id: string; name: string; parent_id: string | null }>): Record<string, CategoryNode> {
  const hierarchy: Record<string, CategoryNode> = {};
  const categoryMap = new Map<string, { id: string; name: string; parent_id: string | null }>();
  
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
    const children = categories.filter(c => c.parent_id === categoryId);
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
  const rootCategories = categories.filter(c => !c.parent_id);
  for (const root of rootCategories) {
    const node = buildNode(root.id);
    if (node) {
      hierarchy[root.id] = node;
    }
  }
  
  return hierarchy;
}

/**
 * Hook to fetch and merge passport form reference data.
 * 
 * Consumes the prefetched `passportFormReferences` query and merges
 * API data with client-side defaults from the selections package.
 * 
 * @returns Merged dropdown options for all form fields
 */
export function usePassportFormData() {
  const trpc = useTRPC();
  
  // Access prefetched data from React Query cache
  const { data, isLoading } = useQuery(
    trpc.composite.passportFormReferences.queryOptions()
  );

  // Merge colors: API colors + default colors from selections
  const colors = React.useMemo(() => {
    const apiColors = data?.brandCatalog.colors || [];
    const defaultColors = allColors;
    
    // Create a map to avoid duplicates (API colors take precedence)
    const colorMap = new Map<string, { id: string; name: string; hex: string }>();
    
    // Add API colors first (these have real IDs from DB)
    // Note: hex is not stored in DB, we look it up from selections
    for (const color of apiColors) {
      const defaultColor = defaultColors.find(c => c.name.toLowerCase() === color.name.toLowerCase());
      colorMap.set(color.name.toLowerCase(), {
        id: color.id,
        name: color.name,
        hex: defaultColor?.hex || "000000"
      });
    }
    
    // Add default colors that aren't already in API colors (these need to be created when used)
    for (const color of defaultColors) {
      if (!colorMap.has(color.name.toLowerCase())) {
        colorMap.set(color.name.toLowerCase(), {
          id: "", // Empty ID means it needs to be created
          name: color.name,
          hex: color.hex
        });
      }
    }
    
    return Array.from(colorMap.values());
  }, [data?.brandCatalog.colors]);

  const categoryMap = React.useMemo(() => {
    const map = new Map<
      string,
      { name: string; parentId: string | null }
    >();
    const rawCategories = data?.categories ?? [];
    for (const category of rawCategories) {
      map.set(category.id, {
        name: category.name,
        parentId: category.parent_id ?? null,
      });
    }
    return map;
  }, [data?.categories]);

  const resolveTierTwoCategoryPath = React.useCallback(
    (categoryId: string | null | undefined): string | null => {
      if (!categoryId) {
        return null;
      }

      const segments: string[] = [];
      let currentId: string | null | undefined = categoryId;
      let guard = 0;

      while (currentId && guard < 10) {
        const node = categoryMap.get(currentId);
        if (!node) {
          break;
        }
        segments.push(node.name);
        currentId = node.parentId;
        guard += 1;
      }

      if (segments.length < 2) {
        return null;
      }

      const topLevel = segments[segments.length - 1];
      const secondLevel = segments[segments.length - 2];
      return `${topLevel} / ${secondLevel}`;
    },
    [categoryMap],
  );

  const sizeOptions = React.useMemo<TierTwoSizeOption[]>(() => {
    const apiSizes = data?.brandCatalog.sizes ?? [];
    const options: TierTwoSizeOption[] = [];

    // Only use API sizes (no defaults)
    for (const size of apiSizes) {
      const categoryPath = resolveTierTwoCategoryPath(size.category_id);
      if (!categoryPath) {
        continue;
      }

      const categoryKey = getCategoryKey(categoryPath);
      if (!categoryKey) {
        continue;
      }

      const option: TierTwoSizeOption = {
        id: size.id,
        name: size.name,
        categoryKey,
        categoryPath,
        sortIndex:
          typeof size.sort_index === "number"
            ? size.sort_index
            : Number.MAX_SAFE_INTEGER,
        source: "brand",
      };
      options.push(option);
    }

    return options;
  }, [data?.brandCatalog.sizes, resolveTierTwoCategoryPath]);

  // Build category hierarchy for CategorySelect component
  const categoryHierarchy = React.useMemo(() => {
    return buildCategoryHierarchy(data?.categories || []);
  }, [data?.categories]);

  // Build tier-two category list for size-related components
  // Extract all tier-2 categories from the category hierarchy
  const tierTwoCategories = React.useMemo<TierTwoCategoryInfo[]>(() => {
    const categorySet = new Set<string>();
    const categoryInfos: TierTwoCategoryInfo[] = [];
    const rawCategories = data?.categories || [];
    
    // Find all tier-2 categories (categories that have a parent)
    for (const category of rawCategories) {
      if (category.parent_id) {
        // This is at least a tier-2 category
        const categoryPath = resolveTierTwoCategoryPath(category.id);
        if (categoryPath) {
          const categoryKey = getCategoryKey(categoryPath);
          if (categoryKey && !categorySet.has(categoryKey)) {
            categorySet.add(categoryKey);
            categoryInfos.push({
              key: categoryKey,
              displayName: categoryPath,
            });
          }
        }
      }
    }
    
    return categoryInfos.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [data?.categories, resolveTierTwoCategoryPath]);

  // Build tier-two category hierarchy for size modal and size select (Men's -> Tops, Bottoms, etc.)
  const tierTwoCategoryHierarchy = React.useMemo<Record<string, string[]>>(() => {
    const hierarchy: Record<string, string[]> = {};
    
    for (const category of tierTwoCategories) {
      const [tierOne, tierTwo] = category.displayName.split(" / ");
      if (!tierOne || !tierTwo) continue;
      
      if (!hierarchy[tierOne]) {
        hierarchy[tierOne] = [];
      }
      hierarchy[tierOne].push(category.displayName);
    }
    
    return hierarchy;
  }, [tierTwoCategories]);

  return {
    // System-level (no merging needed)
    categories: data?.categories || [],
    categoryHierarchy,
    categoryMap,
    
    // Brand catalog (API only, no defaults)
    materials: data?.brandCatalog.materials || [],
    operators: data?.brandCatalog.operators || [],
    facilities: data?.brandCatalog.facilities || [],
    certifications: data?.brandCatalog.certifications || [],
    seasons: (data?.brandCatalog.seasons || []).map(s => ({
      name: s.name,
      startDate: s.startDate ? new Date(s.startDate) : undefined,
      endDate: s.endDate ? new Date(s.endDate) : undefined,
      isOngoing: s.ongoing,
    })),
    
    // Merged with defaults
    colors,
    sizeOptions,
    
    // Size-related
    tierTwoCategories,
    tierTwoCategoryHierarchy,
    
    // Loading state
    isLoading,
  };
}

