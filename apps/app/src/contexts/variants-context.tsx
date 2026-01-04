"use client";

/**
 * VariantsContext
 *
 * Provides centralized variant state management to child components.
 * This context wraps the useVariants hook and adds helper methods
 * for key-based lookups and updates.
 *
 * Key features:
 * - Single source of truth for variant data (including SKU/barcode)
 * - Key-to-localId mapping for efficient lookups
 * - updateVariantByKey helper for direct variant updates from UI
 */

import * as React from "react";
import {
    useVariants,
    type UseVariantsReturn,
    type LocalVariant,
    type ServerVariant,
    type Dimension,
} from "@/hooks/use-variants";

interface VariantsContextValue extends UseVariantsReturn {
    /** Get localId from a pipe-separated key (e.g., "valueId1|valueId2") */
    getLocalIdByKey: (key: string) => string | undefined;
    /** Get variant by key */
    getVariantByKey: (key: string) => LocalVariant | undefined;
    /** Update variant SKU/barcode by key (convenience wrapper) */
    updateVariantByKey: (
        key: string,
        updates: { sku?: string; barcode?: string }
    ) => void;
}

const VariantsContext = React.createContext<VariantsContextValue | null>(null);

/**
 * Provider component that wraps variant-related components.
 * Should be placed in VariantSection to provide variant state to VariantTable and children.
 */
export function VariantsProvider({ children }: { children: React.ReactNode }) {
    const variantsHook = useVariants();

    // Map from key (pipe-separated value IDs) to localId for quick lookups
    const keyToLocalId = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const v of variantsHook.activeVariants) {
            const key = v.attributeValueIds.join("|");
            if (key) {
                map.set(key, v.localId);
            }
        }
        return map;
    }, [variantsHook.activeVariants]);

    // Map from key to variant for quick lookups
    const keyToVariant = React.useMemo(() => {
        const map = new Map<string, LocalVariant>();
        for (const v of variantsHook.activeVariants) {
            const key = v.attributeValueIds.join("|");
            if (key) {
                map.set(key, v);
            }
        }
        return map;
    }, [variantsHook.activeVariants]);

    const getLocalIdByKey = React.useCallback(
        (key: string) => {
            return keyToLocalId.get(key);
        },
        [keyToLocalId]
    );

    const getVariantByKey = React.useCallback(
        (key: string) => {
            return keyToVariant.get(key);
        },
        [keyToVariant]
    );

    const updateVariantByKey = React.useCallback(
        (key: string, updates: { sku?: string; barcode?: string }) => {
            const localId = keyToLocalId.get(key);
            if (localId) {
                variantsHook.updateVariant(localId, updates);
            }
        },
        [keyToLocalId, variantsHook]
    );

    const value = React.useMemo(
        () => ({
            ...variantsHook,
            getLocalIdByKey,
            getVariantByKey,
            updateVariantByKey,
        }),
        [variantsHook, getLocalIdByKey, getVariantByKey, updateVariantByKey]
    );

    return (
        <VariantsContext.Provider value={value}>
            {children}
        </VariantsContext.Provider>
    );
}

/**
 * Hook to access the variants context.
 * Must be used within a VariantsProvider.
 */
export function useVariantsContext() {
    const context = React.useContext(VariantsContext);
    if (!context) {
        throw new Error(
            "useVariantsContext must be used within VariantsProvider"
        );
    }
    return context;
}

/**
 * Optional hook for components that may or may not be within VariantsProvider.
 * Returns null if not within provider (useful for testing or standalone usage).
 */
export function useVariantsContextOptional() {
    return React.useContext(VariantsContext);
}
