"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { FieldWrapper } from "./field-wrapper";
import { CarouselProductsModal } from "@/components/modals/carousel-products-modal";
import type { FilterState } from "@/components/passports/filter-types";
import type { ContentField } from "../../registry/types";
import { useDesignEditor } from "@/contexts/design-editor-provider";

interface CarouselInputProps {
    field: ContentField;
}

/**
 * Field component for carousel product selection.
 * Opens modal and saves selection to themeConfig.carousel.
 */
export function CarouselInput({ field }: CarouselInputProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const { getConfigValue, updateConfigValue } = useDesignEditor();

    // Get current carousel config
    const carouselConfig = getConfigValue("carousel") as {
        includeIds?: string[];
        excludeIds?: string[];
        filter?: Record<string, unknown>;
        selectedCount?: number; // Stored count for display
    } | undefined;

    // Get selected count for display
    // We store the actual count when saving so we don't need to re-fetch
    const selectedCount = carouselConfig?.selectedCount ?? carouselConfig?.includeIds?.length ?? 0;
    const hasSelection = selectedCount > 0;

    // Memoize initialSelection to prevent unnecessary re-renders and stale closures
    // IMPORTANT: Pass undefined (not empty array) for excludeIds when not set,
    // so the modal can distinguish between "all mode" and "explicit mode"
    const initialSelection = useMemo(() => ({
        filter: carouselConfig?.filter as FilterState | undefined,
        includeIds: carouselConfig?.includeIds ?? [],
        excludeIds: carouselConfig?.excludeIds, // Keep undefined if not set!
    }), [carouselConfig?.filter, carouselConfig?.includeIds, carouselConfig?.excludeIds]);

    // Memoize handleSave callback
    const handleSave = useCallback((selection: {
        filter: FilterState | null;
        includeIds: string[];
        excludeIds: string[];
        selectedCount: number;
    }) => {
        // Update carousel config with selection
        // We preserve existing carousel settings and merge in the selection
        const currentConfig = getConfigValue("carousel") as Record<string, unknown> | undefined;

        // Determine mode: if includeIds is empty, we're in "all" mode (excludeIds applies)
        // If includeIds has values, we're in "explicit" mode
        const isAllMode = selection.includeIds.length === 0;
        
        updateConfigValue("carousel", {
            ...currentConfig,
            filter: selection.filter ?? undefined,
            // In explicit mode: save includeIds, clear excludeIds
            // In all mode: save excludeIds (even if empty to indicate "all"), clear includeIds
            includeIds: !isAllMode ? selection.includeIds : undefined,
            excludeIds: isAllMode ? selection.excludeIds : undefined,
            // Store the actual count for display
            selectedCount: selection.selectedCount,
        });
    }, [getConfigValue, updateConfigValue]);

    return (
        <FieldWrapper label={field.label}>
            <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setModalOpen(true)}
            >
                <span className="px-1">
                    {hasSelection
                        ? `${selectedCount} product${selectedCount !== 1 ? "s" : ""} selected`
                        : "Configure"}
                </span>
                <Icons.ChevronRight className="h-4 w-4" />
            </Button>
            <CarouselProductsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                initialSelection={initialSelection}
                onSave={handleSave}
            />
        </FieldWrapper>
    );
}
