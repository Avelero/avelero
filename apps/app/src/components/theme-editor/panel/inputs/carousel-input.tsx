"use client";

import { useState } from "react";
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
    } | undefined;

    // Calculate selected count for display
    const selectedCount = carouselConfig?.includeIds?.length ?? 0;
    const hasSelection = selectedCount > 0 || (carouselConfig?.excludeIds?.length ?? 0) > 0;

    const handleSave = (selection: {
        filter: FilterState | null;
        includeIds: string[];
        excludeIds: string[];
    }) => {
        // Update carousel config with selection
        // We preserve existing carousel settings and merge in the selection
        const currentConfig = getConfigValue("carousel") as Record<string, unknown> | undefined;

        updateConfigValue("carousel", {
            ...currentConfig,
            filter: selection.filter ?? undefined,
            includeIds: selection.includeIds.length > 0 ? selection.includeIds : undefined,
            excludeIds: selection.excludeIds.length > 0 ? selection.excludeIds : undefined,
        });
    };

    return (
        <FieldWrapper label={field.label}>
            <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setModalOpen(true)}
            >
                <span className="px-1">
                    {hasSelection
                        ? selectedCount > 0
                            ? `${selectedCount} product${selectedCount !== 1 ? "s" : ""} selected`
                            : "All products (with exclusions)"
                        : "Configure"}
                </span>
                <Icons.ChevronRight className="h-4 w-4" />
            </Button>
            <CarouselProductsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                initialSelection={{
                    filter: carouselConfig?.filter as FilterState | undefined,
                    includeIds: carouselConfig?.includeIds ?? [],
                    excludeIds: carouselConfig?.excludeIds ?? [],
                }}
                onSave={handleSave}
            />
        </FieldWrapper>
    );
}
