"use client";

import { cn } from "@v1/ui/cn";

type MatchIdentifier = "sku" | "barcode";

interface IdentifierToggleProps {
    value: MatchIdentifier;
    onChange: (value: MatchIdentifier) => void;
    disabled?: boolean;
}

/**
 * A segmented toggle for selecting the match identifier (SKU or Barcode).
 * Used at the top of the integration field configuration.
 */
export function IdentifierToggle({
    value,
    onChange,
    disabled = false,
}: IdentifierToggleProps) {
    return (
        <div className="border border-border p-4 space-y-3">
            <div className="flex flex-col gap-1">
                <h6 className="type-small !font-medium text-foreground">Match Identifier</h6>
                <p className="type-small text-secondary">
                    Choose how products from this integration are matched to existing Avelero products
                </p>
            </div>

            <div className="relative flex h-10 w-full max-w-[320px] p-1 bg-muted rounded-md">
                {/* Sliding background */}
                <div
                    className={cn(
                        "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background border border-border rounded-[4px] transition-all duration-200 ease-out",
                        value === "sku" ? "left-1" : "left-[calc(50%+2px)]"
                    )}
                />

                {/* SKU Option */}
                <button
                    type="button"
                    onClick={() => onChange("sku")}
                    disabled={disabled}
                    className={cn(
                        "relative flex-1 flex items-center justify-center gap-2 z-10 transition-colors duration-150",
                        "type-small !font-medium",
                        value === "sku" ? "text-foreground" : "text-secondary hover:text-foreground",
                        disabled && "cursor-not-allowed opacity-50"
                    )}
                >
                    SKU
                </button>

                {/* Barcode Option */}
                <button
                    type="button"
                    onClick={() => onChange("barcode")}
                    disabled={disabled}
                    className={cn(
                        "relative flex-1 flex items-center justify-center gap-2 z-10 transition-colors duration-150",
                        "type-small !font-medium",
                        value === "barcode" ? "text-foreground" : "text-secondary hover:text-foreground",
                        disabled && "cursor-not-allowed opacity-50"
                    )}
                >
                    Barcode
                </button>
            </div>

            <p className="type-small text-tertiary">
                {value === "sku"
                    ? "SKU matching is best when your SKUs are consistent across systems"
                    : "Barcode matching is best for products with EAN/GTIN codes"
                }
            </p>
        </div>
    );
}
