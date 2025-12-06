/**
 * Type definitions for carousel product selection table.
 */

/**
 * Product row data for carousel selection.
 * Matches the CarouselProductRow from the database query.
 */
export interface CarouselProductRow {
    id: string;
    name: string;
    productIdentifier: string;
    primaryImageUrl: string | null;
    categoryName: string | null;
    seasonName: string | null;
}

/**
 * Selection state for carousel products.
 * Used to track which products are selected for the carousel.
 */
export interface CarouselSelectionState {
    /**
     * Selection mode:
     * - "all": All products matching filter are selected, excludeIds contains deselections
     * - "explicit": Only products in includeIds are selected
     */
    mode: "all" | "explicit";
    /**
     * IDs of products explicitly included (used when mode is "explicit")
     */
    includeIds: string[];
    /**
     * IDs of products excluded from selection (used when mode is "all")
     */
    excludeIds: string[];
}

/**
 * Filter state structure for product queries.
 * Simplified version matching the tRPC schema.
 */
export interface FilterCondition {
    id: string;
    fieldId: string;
    operator: string;
    value: unknown;
    nestedConditions?: FilterCondition[];
}

export interface FilterGroup {
    id: string;
    conditions: FilterCondition[];
    asGroup?: boolean;
}

export interface FilterState {
    groups: FilterGroup[];
}
