"use client";

import type { HeaderContext, Table as ReactTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { cn } from "@v1/ui/cn";
import { TableHead, TableHeader, TableRow } from "@v1/ui/table";
import * as React from "react";
import type { CarouselProductRow } from "./types";

interface ColumnMeta {
    headerClassName?: string;
    cellClassName?: string;
    sticky?: "left" | "right";
}

function getHeaderClassName(
    header: HeaderContext<CarouselProductRow, unknown>["header"],
    meta: ColumnMeta | null,
) {
    const stickyClass =
        meta?.sticky === "left"
            ? "sticky left-0 z-[15] bg-background"
            : meta?.sticky === "right"
                ? "sticky right-0 z-[15] border-l border-border bg-background"
                : "";

    return cn(
        "h-10 px-4 text-left align-middle text-secondary type-small font-medium",
        "bg-background",
        stickyClass,
        meta?.headerClassName,
    );
}

function IndeterminateCheckbox({
    checked,
    indeterminate,
    onChange,
    ariaLabel,
}: {
    checked: boolean;
    indeterminate: boolean;
    onChange: () => void;
    ariaLabel: string;
}) {
    const ref = React.useRef<HTMLInputElement | null>(null);
    React.useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate && !checked;
    }, [indeterminate, checked]);

    // Determine border and background classes based on state
    const isActive = checked || indeterminate;

    return (
        <label
            className="relative inline-flex h-4 w-4 items-center justify-center cursor-pointer before:absolute before:right-[-12px] before:left-[-16px] before:top-[-20px] before:bottom-[-19px] before:content-['']"
            onClick={(event) => event.stopPropagation()}
        >
            <input
                ref={ref}
                type="checkbox"
                aria-label={ariaLabel}
                aria-checked={indeterminate ? "mixed" : checked ? "true" : "false"}
                className={cn(
                    "block h-4 w-4 appearance-none border-[1.5px] bg-background cursor-pointer outline-none focus:outline-none",
                    isActive ? "border-brand" : "border-border"
                )}
                checked={checked}
                onChange={(e) => {
                    (e.target as HTMLInputElement).blur();
                    onChange();
                }}
            />
            {isActive && (
                <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
                    <div className="w-[10px] h-[10px] bg-brand" />
                </div>
            )}
        </label>
    );
}

export function CarouselTableHeader({
    table,
    onSelectAllAction,
    onClearSelectionAction,
    isAllMode,
    hasAnySelection,
}: {
    table: ReactTable<CarouselProductRow>;
    onSelectAllAction?: () => void;
    onClearSelectionAction?: () => void;
    isAllMode?: boolean;
    hasAnySelection?: boolean;
}) {
    const isAllPageSelected = table.getIsAllPageRowsSelected();
    const isSomePageSelected = table.getIsSomePageRowsSelected();

    const checked = isAllMode || isAllPageSelected;
    const indeterminate = !isAllMode && isSomePageSelected && !isAllPageSelected;

    return (
        <TableHeader className="sticky top-0 z-20 border-b border-border bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="h-10 border-b border-border">
                    {headerGroup.headers.map((header) => {
                        const meta = (header.column.columnDef.meta ??
                            null) as ColumnMeta | null;

                        const isProductHeader = header.column.id === "product";

                        return (
                            <TableHead
                                key={header.id}
                                className={getHeaderClassName(header, meta)}
                            >
                                {isProductHeader ? (
                                    <div className="flex items-center gap-4">
                                        <IndeterminateCheckbox
                                            checked={checked}
                                            indeterminate={indeterminate}
                                            onChange={() => {
                                                if (hasAnySelection) {
                                                    onClearSelectionAction?.();
                                                } else {
                                                    onSelectAllAction?.();
                                                }
                                            }}
                                            ariaLabel="Select all products"
                                        />
                                        <span className="whitespace-nowrap">Product title</span>
                                    </div>
                                ) : header.isPlaceholder ? null : (
                                    <span className="whitespace-nowrap">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </span>
                                )}
                            </TableHead>
                        );
                    })}
                </TableRow>
            ))}
        </TableHeader>
    );
}
