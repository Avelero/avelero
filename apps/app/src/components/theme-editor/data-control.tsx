"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { DEMO_DPP_DATA } from "@/lib/demo-data";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { useEffect, useState } from "react";

type DataSource = "mock" | "real";

/**
 * Data control component for the theme editor header.
 * Allows switching between mock data and real product data for preview.
 *
 * Layout (left to right):
 * - Navigation arrows (only visible when "Real" is selected)
 * - Toggle (Mock | Real)
 * - [gap] User menu (handled by parent)
 */
export function DataControl() {
    const [dataSource, setDataSource] = useState<DataSource>("mock");
    const [currentProductIndex, setCurrentProductIndex] = useState(0);

    const trpc = useTRPC();
    const { setPreviewData, brandId } = useDesignEditor();

    // Always fetch products list to check availability
    const { data: productsData, isLoading: isLoadingProducts } = useQuery({
        ...trpc.brand.themePreview.list.queryOptions({
            limit: 50, // Fetch enough products for navigation
        }),
        enabled: !!brandId,
    });

    const products = productsData?.items ?? [];
    const hasProducts = products.length > 0;
    const currentProduct = products[currentProductIndex];

    // Fetch current product's DPP data
    const { data: productDppData, isLoading: isLoadingProduct } = useQuery({
        ...trpc.brand.themePreview.getProduct.queryOptions({
            productId: currentProduct?.id ?? "",
        }),
        enabled: dataSource === "real" && !!currentProduct?.id && !!brandId,
    });

    // Update preview data when source or product changes
    useEffect(() => {
        if (dataSource === "mock") {
            setPreviewData(DEMO_DPP_DATA);
        } else if (productDppData) {
            setPreviewData(productDppData);
        }
    }, [dataSource, productDppData, setPreviewData]);

    // Navigate to previous (newer) product
    const handlePrev = () => {
        if (currentProductIndex > 0) {
            setCurrentProductIndex(currentProductIndex - 1);
        }
    };

    // Navigate to next (older) product
    const handleNext = () => {
        if (currentProductIndex < products.length - 1) {
            setCurrentProductIndex(currentProductIndex + 1);
        }
    };

    const canGoPrev = currentProductIndex > 0;
    const canGoNext = currentProductIndex < products.length - 1;
    const isLoading = isLoadingProducts || isLoadingProduct;

    // If switching to real but no products, fall back to mock
    useEffect(() => {
        if (dataSource === "real" && !isLoadingProducts && !hasProducts) {
            setDataSource("mock");
        }
    }, [dataSource, isLoadingProducts, hasProducts]);

    // Hide component entirely if there are no products
    if (!isLoadingProducts && !hasProducts) {
        return null;
    }

    // Don't render until we know if there are products
    if (isLoadingProducts) {
        return null;
    }

    return (
        <div className="flex items-center gap-4">
            {/* Navigation arrows - only shown when Real is selected */}
            {dataSource === "real" && hasProducts && (
                <div className="flex items-center gap-2">
                    <NavigationButton
                        direction="prev"
                        onClick={handlePrev}
                        disabled={!canGoPrev || isLoading}
                    />
                    <NavigationButton
                        direction="next"
                        onClick={handleNext}
                        disabled={!canGoNext || isLoading}
                    />
                </div>
            )}

            {/* Toggle: Mock | Real */}
            <DataSourceToggle
                value={dataSource}
                onChange={setDataSource}
                loading={isLoadingProduct}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Component
// ─────────────────────────────────────────────────────────────────────────────

interface DataSourceToggleProps {
    value: DataSource;
    onChange: (value: DataSource) => void;
    loading?: boolean;
}

function DataSourceToggle({
    value,
    onChange,
    loading,
}: DataSourceToggleProps) {
    return (
        <div className="relative flex h-8 items-center rounded-full bg-accent-dark p-1">
            {/* Sliding pill background */}
            <div
                className={cn(
                    "absolute h-6 rounded-full bg-background border border-border transition-all duration-200 ease-out",
                    value === "mock" ? "left-1" : "left-[calc(50%)]",
                )}
                style={{ width: "calc(50% - 4px)" }}
            />

            {/* Mock button */}
            <button
                type="button"
                onClick={() => onChange("mock")}
                className="relative z-10 flex h-6 items-center justify-center rounded-full px-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
                <p
                    className={cn(
                        "type-small !leading-[24px]",
                        value === "mock" ? "text-foreground" : "text-foreground",
                    )}
                >
                    Mock
                </p>
            </button>

            {/* Real button */}
            <button
                type="button"
                onClick={() => onChange("real")}
                className="relative z-10 flex h-6 items-center justify-center rounded-full px-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
                <p
                    className={cn(
                        "type-small !leading-[24px]",
                        value === "real" ? "text-foreground" : "text-foreground",
                        loading && value === "real" && "opacity-70",
                    )}
                >
                    Real
                </p>
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Button Component
// ─────────────────────────────────────────────────────────────────────────────

interface NavigationButtonProps {
    direction: "prev" | "next";
    onClick: () => void;
    disabled?: boolean;
}

function NavigationButton({
    direction,
    onClick,
    disabled,
}: NavigationButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                "bg-background border border-border",
                "transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-accent cursor-pointer",
            )}
        >
            {direction === "prev" ? (
                <Icons.ChevronLeft className="h-4 w-4" />
            ) : (
                <Icons.ChevronRight className="h-4 w-4" />
            )}
        </button>
    );
}
