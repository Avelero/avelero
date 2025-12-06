"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@v1/ui/cn";
import Image from "next/image";
import type { CarouselProductRow } from "./types";
import { buildPublicUrl } from "@/utils/storage-urls";

const CELL_PADDING_X = "px-4";
const CELL_HEIGHT = "h-14";

/**
 * Column definitions for the carousel product selection table.
 * Selection checkbox is rendered in the first column.
 */
export const columns: ColumnDef<CarouselProductRow>[] = [
    // Product column (includes checkbox, image, name, identifier)
    {
        id: "product",
        header: "Product title",
        enableSorting: false,
        enableHiding: false,
        size: 320,
        minSize: 200,
        meta: {
            sticky: "left",
            headerClassName: cn(CELL_PADDING_X, CELL_HEIGHT, "min-w-[280px]"),
            cellClassName: cn(CELL_PADDING_X, CELL_HEIGHT, "min-w-[280px]"),
        },
        cell: ({ row }) => {
            const product = row.original;

            return (
                <div className="flex h-full items-center gap-4">
                    {/* Checkbox */}
                    <label
                        className="relative inline-flex h-4 w-4 items-center justify-center cursor-pointer before:absolute before:right-[-12px] before:left-[-16px] before:top-[-21px] before:bottom-[-21px] before:content-['']"
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => {
                            if (event.shiftKey) {
                                event.preventDefault();
                            }
                        }}
                    >
                        <input
                            type="checkbox"
                            aria-label={`Select ${product.name}`}
                            className="block h-4 w-4 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer outline-none focus:outline-none"
                            checked={row.getIsSelected()}
                            onChange={(event) => {
                                (event.target as HTMLInputElement).blur();
                                row.toggleSelected(event.target.checked);
                            }}
                        />
                        {row.getIsSelected() && (
                            <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
                                <div className="w-[10px] h-[10px] bg-brand" />
                            </div>
                        )}
                    </label>

                    {/* Image */}
                    <div className="w-10 h-10 bg-accent-light overflow-hidden flex items-center justify-center flex-shrink-0">
                        {product.primaryImagePath ? (
                            <Image
                                src={buildPublicUrl("products", product.primaryImagePath) ?? ""}
                                alt={product.name}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-accent-light" />
                        )}
                    </div>

                    {/* Name & Identifier */}
                    <div className="min-w-0 space-y-0.5">
                        <span className="block max-w-full truncate type-p text-primary">
                            {product.name}
                        </span>
                        {product.productIdentifier && (
                            <span className="block max-w-full truncate type-small text-secondary">
                                {product.productIdentifier}
                            </span>
                        )}
                    </div>
                </div>
            );
        },
    },
    // Category
    {
        id: "category",
        header: "Category",
        cell: ({ row }) => {
            const category = row.original.categoryName;

            if (!category) {
                return <span className="text-secondary">—</span>;
            }

            return (
                <span className="inline-block max-w-[160px] truncate type-p text-primary">
                    {category}
                </span>
            );
        },
        meta: {
            headerClassName: cn(CELL_PADDING_X, CELL_HEIGHT, "w-[180px] min-w-[140px]"),
            cellClassName: cn(CELL_PADDING_X, CELL_HEIGHT, "w-[180px] min-w-[140px]"),
        },
    },
    // Season
    {
        id: "season",
        header: "Season",
        cell: ({ row }) => {
            const season = row.original.seasonName;

            if (!season) {
                return <span className="text-secondary">—</span>;
            }

            return (
                <span className="inline-flex h-6 items-center rounded-full border bg-background px-2 type-small text-primary">
                    {season}
                </span>
            );
        },
        meta: {
            headerClassName: cn(CELL_PADDING_X, CELL_HEIGHT, "w-[160px] min-w-[120px]"),
            cellClassName: cn(CELL_PADDING_X, CELL_HEIGHT, "w-[160px] min-w-[120px]"),
        },
    },
];
