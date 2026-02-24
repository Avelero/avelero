import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
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

export interface TaxonomyAttribute {
  id: string;
  friendlyId: string;
  name: string;
}

export interface BrandAttribute {
  id: string;
  name: string;
  taxonomyAttributeId: string | null;
}

export interface BrandAttributeValue {
  id: string;
  attributeId: string;
  name: string;
  taxonomyValueId: string | null;
  metadata: unknown;
  sortOrder: number | null;
}

function extractHex(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.swatch === "string") return m.swatch;
  if (typeof m.hex === "string") {
    return m.hex.startsWith("#") ? m.hex : `#${m.hex}`;
  }
  return null;
}

/**
 * Legacy SizeOption type for backwards compatibility with filter components.
 */
export interface SizeOption {
  id?: string;
  name: string;
  displayHint: number;
  isDefault: boolean;
}

/**
 * Transforms flat category list into hierarchical structure
 */
function buildCategoryHierarchy(
  categories: Array<{ id: string; name: string; parentId: string | null }>,
): Record<string, CategoryNode> {
  const hierarchy: Record<string, CategoryNode> = {};
  const categoryMap = new Map<
    string,
    { id: string; name: string; parentId: string | null }
  >();

  for (const category of categories) {
    categoryMap.set(category.id, category);
  }

  function buildNode(categoryId: string): CategoryNode | null {
    const category = categoryMap.get(categoryId);
    if (!category) return null;

    const node: CategoryNode = {
      label: category.name,
      id: category.id,
    };

    const children = categories.filter((c) => c.parentId === categoryId);
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

  const rootCategories = categories.filter((c) => !c.parentId);
  for (const root of rootCategories) {
    const node = buildNode(root.id);
    if (node) {
      hierarchy[root.id] = node;
    }
  }

  return hierarchy;
}

/**
 * Hook to fetch brand catalog reference data.
 *
 * Provides taxonomy (global), brand catalog (brand-specific), categories,
 * and other reference data for the application.
 */
export function useBrandCatalog() {
  const trpc = useTRPC();

  const { data } = useSuspenseQuery(
    trpc.composite.catalogContent.queryOptions(),
  );

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, { name: string; parentId: string | null }>();
    const rawCategories = data?.categories ?? [];
    for (const category of rawCategories) {
      map.set(category.id, {
        name: category.name,
        parentId: category.parentId ?? null,
      });
    }
    return map;
  }, [data?.categories]);

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

  // Taxonomy attributes (global, read-only)
  const taxonomyAttributes = React.useMemo<TaxonomyAttribute[]>(() => {
    return (data?.taxonomy?.attributes ?? []).map((attr: any) => ({
      id: attr.id,
      friendlyId: attr.friendlyId,
      name: attr.name,
    }));
  }, [data?.taxonomy?.attributes]);

  // Brand attributes
  const brandAttributes = React.useMemo<BrandAttribute[]>(() => {
    return (data?.brandCatalog.attributes ?? []).map((attr: any) => ({
      id: attr.id,
      name: attr.name,
      taxonomyAttributeId: attr.taxonomyAttributeId ?? null,
    }));
  }, [data?.brandCatalog.attributes]);

  // Brand attribute values grouped by attribute
  const brandAttributeValuesByAttribute = React.useMemo(() => {
    const map = new Map<string, BrandAttributeValue[]>();
    for (const val of data?.brandCatalog.attributeValues ?? []) {
      const list = map.get(val.attributeId) ?? [];
      list.push({
        id: val.id,
        attributeId: val.attributeId,
        name: val.name,
        taxonomyValueId: val.taxonomyValueId ?? null,
        metadata: val.metadata ?? {},
        sortOrder: val.sortOrder ?? null,
      });
      map.set(val.attributeId, list);
    }
    for (const [key, list] of map) {
      map.set(
        key,
        [...list].sort((a, b) => {
          const aOrder = a.sortOrder ?? Number.POSITIVE_INFINITY;
          const bOrder = b.sortOrder ?? Number.POSITIVE_INFINITY;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name);
        }),
      );
    }
    return map;
  }, [data?.brandCatalog.attributeValues]);

  // Legacy: derive sizeOptions from "Size" attribute values (for filter components)
  const sizeOptions = React.useMemo<SizeOption[]>(() => {
    const sizeAttr = taxonomyAttributes.find((a) => a.friendlyId === "size");
    if (!sizeAttr) return [];

    const brandAttr = brandAttributes.find(
      (a) => a.taxonomyAttributeId === sizeAttr.id,
    );
    if (!brandAttr) return [];

    const values = brandAttributeValuesByAttribute.get(brandAttr.id) ?? [];

    return values
      .map((v, idx) => ({
        id: v.id,
        name: v.name,
        displayHint: v.sortOrder ?? 1000 + idx,
        isDefault: v.sortOrder !== null || !!v.taxonomyValueId,
      }))
      .sort((a, b) => a.displayHint - b.displayHint);
  }, [
    taxonomyAttributes,
    brandAttributes,
    brandAttributeValuesByAttribute,
  ]);

  // Legacy: derive colors from "Color" attribute values (for filter components)
  const colors = React.useMemo(() => {
    const colorAttr = taxonomyAttributes.find((a) => a.friendlyId === "color");
    if (!colorAttr) return [];

    const brandAttr = brandAttributes.find(
      (a) => a.taxonomyAttributeId === colorAttr.id,
    );
    if (!brandAttr) return [];

    const values = brandAttributeValuesByAttribute.get(brandAttr.id) ?? [];

    return values.map((v) => ({
      id: v.id,
      name: v.name,
      hex: extractHex(v.metadata),
    }));
  }, [
    taxonomyAttributes,
    brandAttributes,
    brandAttributeValuesByAttribute,
  ]);

  return {
    // System-level
    categories: data?.categories || [],
    categoryHierarchy,
    categoryMap,

    // Taxonomy (global, read-only)
    taxonomyAttributes,

    // Brand catalog
    brandAttributes,
    brandAttributeValuesByAttribute,
    materials: data?.brandCatalog.materials || [],
    operators: data?.brandCatalog.operators || [],
    certifications: data?.brandCatalog.certifications || [],
    manufacturers: data?.brandCatalog.manufacturers || [],
    seasons: (data?.brandCatalog.seasons || []).map((s: any) => ({
      id: s.id ?? "",
      name: s.name,
      startDate: s.startDate ? new Date(s.startDate) : undefined,
      endDate: s.endDate ? new Date(s.endDate) : undefined,
      isOngoing: s.ongoing,
    })),
    tags,

    // Legacy compatibility
    sizeOptions,
    colors,
  };
}
