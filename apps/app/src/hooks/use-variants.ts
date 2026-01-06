/**
 * Variant state management hook.
 *
 * Provides centralized state management for product variants with:
 * - Stable local IDs for unsaved variants
 * - UPID tracking for saved variants
 * - Shopify-style dimension management (additive, not replacement)
 * - Sync preparation for API calls
 */

import * as React from "react";

// ============================================================================
// Types
// ============================================================================

/**
 * A variant as managed in local state.
 * Uses localId for session tracking, upid for server identity.
 */
export interface LocalVariant {
    /** Stable client-side identifier (UUID), persists during session */
    localId: string;
    /** Server identifier (UPID), null if not yet saved */
    upid: string | null;
    /** SKU code */
    sku: string;
    /** Barcode */
    barcode: string;
    /** Ordered list of attribute value IDs */
    attributeValueIds: string[];
    /** Variant status for sync tracking */
    status: "new" | "modified" | "unchanged" | "deleted";
}

/**
 * A dimension (attribute) used for UI grouping and display.
 */
export interface Dimension {
    /** Brand attribute ID */
    attributeId: string;
    /** Display name */
    attributeName: string;
    /** Linked taxonomy attribute ID if applicable */
    taxonomyAttributeId: string | null;
    /** Value IDs used across variants for this dimension */
    valueIds: string[];
}

/**
 * Input for creating a new variant.
 */
export interface AddVariantInput {
    attributeValueIds?: string[];
    sku?: string;
    barcode?: string;
    upid?: string | null;
}

/**
 * Server variant data for hydration.
 */
export interface ServerVariant {
    upid: string | null;
    sku: string | null;
    barcode: string | null;
    attributes: Array<{
        attribute_id: string;
        attribute_name: string;
        taxonomy_attribute_id: string | null;
        value_id: string;
        value_name: string;
    }>;
}

/**
 * Variant input for sync operation.
 */
export interface SyncVariantInput {
    upid?: string;
    attributeValueIds: string[];
    sku?: string;
    barcode?: string;
}

export interface VariantsState {
    variants: LocalVariant[];
    dimensions: Dimension[];
}

// ============================================================================
// Utilities
// ============================================================================

function generateLocalId(): string {
    return crypto.randomUUID();
}

/**
 * Compute the cartesian product of arrays.
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
    if (arrays.length === 0) return [[]];
    const [first, ...rest] = arrays;
    const restProduct = cartesianProduct(rest);
    const result: T[][] = [];
    for (const item of first!) {
        for (const combo of restProduct) {
            result.push([item, ...combo]);
        }
    }
    return result;
}

// ============================================================================
// Reducer
// ============================================================================

type VariantsAction =
    | { type: "ADD_VARIANT"; variant: LocalVariant }
    | { type: "UPDATE_VARIANT"; localId: string; updates: Partial<Omit<LocalVariant, "localId">> }
    | { type: "REMOVE_VARIANT"; localId: string }
    | { type: "MARK_DELETED"; localId: string }
    | { type: "ADD_DIMENSION"; dimension: Dimension }
    | { type: "REMOVE_DIMENSION"; attributeId: string }
    | {
        type: "ADD_VALUE_TO_DIMENSION";
        attributeId: string;
        valueId: string;
        otherDimensionValues: Map<string, string[]>;
    }
    | { type: "REMOVE_VALUE_FROM_DIMENSION"; attributeId: string; valueId: string }
    | { type: "HYDRATE"; variants: LocalVariant[]; dimensions: Dimension[] }
    | { type: "RESET" };

function variantsReducer(state: VariantsState, action: VariantsAction): VariantsState {
    switch (action.type) {
        case "ADD_VARIANT": {
            return {
                ...state,
                variants: [...state.variants, action.variant],
            };
        }

        case "UPDATE_VARIANT": {
            return {
                ...state,
                variants: state.variants.map((v) =>
                    v.localId === action.localId
                        ? { ...v, ...action.updates, status: v.upid ? "modified" : v.status }
                        : v
                ),
            };
        }

        case "REMOVE_VARIANT": {
            return {
                ...state,
                variants: state.variants.filter((v) => v.localId !== action.localId),
            };
        }

        case "MARK_DELETED": {
            return {
                ...state,
                variants: state.variants.map((v) =>
                    v.localId === action.localId ? { ...v, status: "deleted" as const } : v
                ),
            };
        }

        case "ADD_DIMENSION": {
            // Check if dimension already exists
            if (state.dimensions.some((d) => d.attributeId === action.dimension.attributeId)) {
                return state;
            }
            return {
                ...state,
                dimensions: [...state.dimensions, action.dimension],
            };
        }

        case "REMOVE_DIMENSION": {
            // Mark all variants that have values from this dimension as deleted
            const dimension = state.dimensions.find((d) => d.attributeId === action.attributeId);
            if (!dimension) return state;

            const dimensionValueSet = new Set(dimension.valueIds);
            const updatedVariants = state.variants.map((v) => {
                const hasValueFromDimension = v.attributeValueIds.some((id) => dimensionValueSet.has(id));
                if (hasValueFromDimension && v.upid) {
                    return { ...v, status: "deleted" as const };
                }
                if (hasValueFromDimension && !v.upid) {
                    // Remove unsaved variants entirely (will be filtered out)
                    return { ...v, status: "deleted" as const };
                }
                return v;
            });

            return {
                variants: updatedVariants.filter((v) => v.upid || v.status !== "deleted"),
                dimensions: state.dimensions.filter((d) => d.attributeId !== action.attributeId),
            };
        }

        case "ADD_VALUE_TO_DIMENSION": {
            const { attributeId, valueId, otherDimensionValues } = action;
            const dimIndex = state.dimensions.findIndex((d) => d.attributeId === attributeId);

            if (dimIndex === -1) return state;

            const dimension = state.dimensions[dimIndex]!;

            // Add value to dimension if not already present
            if (dimension.valueIds.includes(valueId)) return state;

            const updatedDimension = {
                ...dimension,
                valueIds: [...dimension.valueIds, valueId],
            };

            const updatedDimensions = [...state.dimensions];
            updatedDimensions[dimIndex] = updatedDimension;

            // Shopify behavior:
            // - If this is the first value in this dimension, assign it to all existing variants
            // - If there are existing values, create new variants for the cartesian product
            //   of the new value with existing combinations of OTHER dimensions

            const isFirstValueInDimension = dimension.valueIds.length === 0;
            let updatedVariants = [...state.variants];
            const activeVariants = updatedVariants.filter((v) => v.status !== "deleted");

            if (isFirstValueInDimension) {
                // Assign the new value to all existing variants
                if (activeVariants.length > 0) {
                    updatedVariants = updatedVariants.map((v) => {
                        // Skip deleted variants
                        if (v.status === "deleted") return v;

                        return {
                            ...v,
                            attributeValueIds: [...v.attributeValueIds, valueId],
                            status: v.upid ? ("modified" as const) : v.status,
                        };
                    });
                } else {
                    // No existing variants - create a new variant with just this value
                    const newVariant: LocalVariant = {
                        localId: generateLocalId(),
                        upid: null,
                        sku: "",
                        barcode: "",
                        attributeValueIds: [valueId],
                        status: "new",
                    };
                    updatedVariants.push(newVariant);
                }
            } else {
                // Create new variants for: newValue × all combinations of other dimensions
                // Get other dimension value arrays
                const otherDimArrays: string[][] = [];
                for (const [dimAttrId, values] of otherDimensionValues) {
                    if (dimAttrId !== attributeId && values.length > 0) {
                        otherDimArrays.push(values);
                    }
                }

                // Generate combinations
                const otherCombinations = cartesianProduct(otherDimArrays);

                // Create new variants
                for (const otherCombo of otherCombinations) {
                    const newAttributeValueIds = [valueId, ...otherCombo];

                    // Check if this combination already exists
                    const exists = state.variants.some((v) => {
                        if (v.status === "deleted") return false;
                        if (v.attributeValueIds.length !== newAttributeValueIds.length) return false;
                        const valueSet = new Set(v.attributeValueIds);
                        return newAttributeValueIds.every((id) => valueSet.has(id));
                    });

                    if (!exists) {
                        const newVariant: LocalVariant = {
                            localId: generateLocalId(),
                            upid: null,
                            sku: "",
                            barcode: "",
                            attributeValueIds: newAttributeValueIds,
                            status: "new",
                        };
                        updatedVariants.push(newVariant);
                    }
                }
            }

            return {
                variants: updatedVariants,
                dimensions: updatedDimensions,
            };
        }

        case "REMOVE_VALUE_FROM_DIMENSION": {
            const { attributeId, valueId } = action;
            const dimIndex = state.dimensions.findIndex((d) => d.attributeId === attributeId);

            if (dimIndex === -1) return state;

            const dimension = state.dimensions[dimIndex]!;

            // Remove value from dimension
            const updatedDimension = {
                ...dimension,
                valueIds: dimension.valueIds.filter((v) => v !== valueId),
            };

            const updatedDimensions = [...state.dimensions];
            updatedDimensions[dimIndex] = updatedDimension;

            // Mark variants with this value as deleted
            const updatedVariants = state.variants.map((v) => {
                if (v.attributeValueIds.includes(valueId)) {
                    if (v.upid) {
                        // Saved variant - mark for deletion
                        return { ...v, status: "deleted" as const };
                    }
                    // Unsaved variant - will be filtered out
                    return { ...v, status: "deleted" as const };
                }
                return v;
            });

            return {
                variants: updatedVariants.filter((v) => v.upid || v.status !== "deleted"),
                dimensions: updatedDimensions,
            };
        }

        case "HYDRATE": {
            return {
                variants: action.variants,
                dimensions: action.dimensions,
            };
        }

        case "RESET": {
            return {
                variants: [],
                dimensions: [],
            };
        }

        default:
            return state;
    }
}

// ============================================================================
// Hook
// ============================================================================

export interface UseVariantsOptions {
    /** Called when variant metadata needs to be synced for display */
    onVariantMetadataChange?: (
        metadata: Record<string, { sku: string; barcode: string }>
    ) => void;
}

export interface UseVariantsReturn {
    state: VariantsState;

    // Variant operations
    addVariant: (input: AddVariantInput) => string;
    updateVariant: (localId: string, updates: Partial<Omit<LocalVariant, "localId">>) => void;
    removeVariant: (localId: string) => void;

    // Dimension operations (Shopify-style)
    addDimension: (
        attributeId: string,
        attributeName: string,
        taxonomyAttributeId?: string | null
    ) => void;
    removeDimension: (attributeId: string) => void;
    addValueToDimension: (attributeId: string, valueId: string) => void;
    removeValueFromDimension: (attributeId: string, valueId: string) => void;

    // Hydration & sync
    hydrateFromServer: (variants: ServerVariant[]) => void;
    prepareForSync: () => {
        toCreate: SyncVariantInput[];
        toUpdate: SyncVariantInput[];
        toDelete: string[];
    };

    // Reset
    reset: () => void;

    // Computed
    hasUnsavedChanges: boolean;
    activeVariants: LocalVariant[];
    newVariants: LocalVariant[];
    modifiedVariants: LocalVariant[];
    deletedVariants: LocalVariant[];
}

export function useVariants(options?: UseVariantsOptions): UseVariantsReturn {
    const initialState: VariantsState = { variants: [], dimensions: [] };
    const [state, dispatch] = React.useReducer(variantsReducer, initialState);

    // Track initial state for change detection
    const initialSnapshotRef = React.useRef<string | null>(null);

    // ─── Variant operations ────────────────────────────────────────────

    const addVariant = React.useCallback((input: AddVariantInput): string => {
        const localId = generateLocalId();
        const variant: LocalVariant = {
            localId,
            upid: input.upid ?? null,
            sku: input.sku ?? "",
            barcode: input.barcode ?? "",
            attributeValueIds: input.attributeValueIds ?? [],
            status: input.upid ? "unchanged" : "new",
        };
        dispatch({ type: "ADD_VARIANT", variant });
        return localId;
    }, []);

    const updateVariant = React.useCallback(
        (localId: string, updates: Partial<Omit<LocalVariant, "localId">>) => {
            dispatch({ type: "UPDATE_VARIANT", localId, updates });
        },
        []
    );

    const removeVariant = React.useCallback((localId: string) => {
        const variant = state.variants.find((v) => v.localId === localId);
        if (variant?.upid) {
            // Saved variant - mark for deletion
            dispatch({ type: "MARK_DELETED", localId });
        } else {
            // Unsaved variant - remove immediately
            dispatch({ type: "REMOVE_VARIANT", localId });
        }
    }, [state.variants]);

    // ─── Dimension operations ──────────────────────────────────────────

    const addDimension = React.useCallback(
        (
            attributeId: string,
            attributeName: string,
            taxonomyAttributeId?: string | null
        ) => {
            dispatch({
                type: "ADD_DIMENSION",
                dimension: {
                    attributeId,
                    attributeName,
                    taxonomyAttributeId: taxonomyAttributeId ?? null,
                    valueIds: [],
                },
            });
        },
        []
    );

    const removeDimension = React.useCallback((attributeId: string) => {
        dispatch({ type: "REMOVE_DIMENSION", attributeId });
    }, []);

    const addValueToDimension = React.useCallback(
        (attributeId: string, valueId: string) => {
            // Build map of other dimension values for cartesian product
            const otherDimensionValues = new Map<string, string[]>();
            for (const dim of state.dimensions) {
                otherDimensionValues.set(dim.attributeId, dim.valueIds);
            }

            dispatch({
                type: "ADD_VALUE_TO_DIMENSION",
                attributeId,
                valueId,
                otherDimensionValues,
            });
        },
        [state.dimensions]
    );

    const removeValueFromDimension = React.useCallback(
        (attributeId: string, valueId: string) => {
            dispatch({ type: "REMOVE_VALUE_FROM_DIMENSION", attributeId, valueId });
        },
        []
    );

    // ─── Hydration ─────────────────────────────────────────────────────

    const hydrateFromServer = React.useCallback((serverVariants: ServerVariant[]) => {
        // Build dimensions from variant attributes
        const dimensionMap = new Map<
            string,
            {
                attributeId: string;
                attributeName: string;
                taxonomyAttributeId: string | null;
                valueIds: Set<string>;
            }
        >();

        const localVariants: LocalVariant[] = [];

        for (const sv of serverVariants) {
            const attributeValueIds: string[] = [];

            for (const attr of sv.attributes) {
                const attrId = attr.attribute_id;
                const valueId = attr.value_id;

                attributeValueIds.push(valueId);

                if (!dimensionMap.has(attrId)) {
                    dimensionMap.set(attrId, {
                        attributeId: attrId,
                        attributeName: attr.attribute_name,
                        taxonomyAttributeId: attr.taxonomy_attribute_id,
                        valueIds: new Set(),
                    });
                }
                dimensionMap.get(attrId)!.valueIds.add(valueId);
            }

            localVariants.push({
                localId: generateLocalId(),
                upid: sv.upid,
                sku: sv.sku ?? "",
                barcode: sv.barcode ?? "",
                attributeValueIds,
                status: "unchanged",
            });
        }

        const dimensions: Dimension[] = Array.from(dimensionMap.values()).map((d) => ({
            attributeId: d.attributeId,
            attributeName: d.attributeName,
            taxonomyAttributeId: d.taxonomyAttributeId,
            valueIds: Array.from(d.valueIds),
        }));

        dispatch({ type: "HYDRATE", variants: localVariants, dimensions });

        // Set initial snapshot for change detection
        initialSnapshotRef.current = JSON.stringify({
            variants: localVariants.map((v) => ({
                upid: v.upid,
                sku: v.sku,
                barcode: v.barcode,
                attributeValueIds: [...v.attributeValueIds].sort(),
            })),
            dimensions: dimensions.map((d) => ({
                attributeId: d.attributeId,
                valueIds: [...d.valueIds].sort(),
            })),
        });
    }, []);

    // ─── Sync preparation ──────────────────────────────────────────────

    const prepareForSync = React.useCallback(() => {
        const toCreate: SyncVariantInput[] = [];
        const toUpdate: SyncVariantInput[] = [];
        const toDelete: string[] = [];

        for (const variant of state.variants) {
            switch (variant.status) {
                case "new":
                    toCreate.push({
                        attributeValueIds: variant.attributeValueIds,
                        sku: variant.sku || undefined,
                        barcode: variant.barcode || undefined,
                    });
                    break;
                case "modified":
                    if (variant.upid) {
                        toUpdate.push({
                            upid: variant.upid,
                            attributeValueIds: variant.attributeValueIds,
                            sku: variant.sku || undefined,
                            barcode: variant.barcode || undefined,
                        });
                    }
                    break;
                case "deleted":
                    if (variant.upid) {
                        toDelete.push(variant.upid);
                    }
                    break;
            }
        }

        return { toCreate, toUpdate, toDelete };
    }, [state.variants]);

    // ─── Reset ─────────────────────────────────────────────────────────

    const reset = React.useCallback(() => {
        dispatch({ type: "RESET" });
        initialSnapshotRef.current = null;
    }, []);

    // ─── Computed values ───────────────────────────────────────────────

    const activeVariants = React.useMemo(
        () => state.variants.filter((v) => v.status !== "deleted"),
        [state.variants]
    );

    const newVariants = React.useMemo(
        () => state.variants.filter((v) => v.status === "new"),
        [state.variants]
    );

    const modifiedVariants = React.useMemo(
        () => state.variants.filter((v) => v.status === "modified"),
        [state.variants]
    );

    const deletedVariants = React.useMemo(
        () => state.variants.filter((v) => v.status === "deleted"),
        [state.variants]
    );

    const hasUnsavedChanges = React.useMemo(() => {
        if (initialSnapshotRef.current === null) {
            // No initial snapshot - check if we have any data
            return state.variants.length > 0 || state.dimensions.length > 0;
        }

        const currentSnapshot = JSON.stringify({
            variants: state.variants
                .filter((v) => v.status !== "deleted")
                .map((v) => ({
                    upid: v.upid,
                    sku: v.sku,
                    barcode: v.barcode,
                    attributeValueIds: [...v.attributeValueIds].sort(),
                })),
            dimensions: state.dimensions.map((d) => ({
                attributeId: d.attributeId,
                valueIds: [...d.valueIds].sort(),
            })),
        });

        return currentSnapshot !== initialSnapshotRef.current;
    }, [state.variants, state.dimensions]);

    return {
        state,
        addVariant,
        updateVariant,
        removeVariant,
        addDimension,
        removeDimension,
        addValueToDimension,
        removeValueFromDimension,
        hydrateFromServer,
        prepareForSync,
        reset,
        hasUnsavedChanges,
        activeVariants,
        newVariants,
        modifiedVariants,
        deletedVariants,
    };
}
