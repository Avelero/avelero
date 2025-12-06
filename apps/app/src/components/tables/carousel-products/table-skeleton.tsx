"use client";

import {
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Skeleton } from "@v1/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@v1/ui/table";
import { columns } from "./columns";
import type { CarouselProductRow } from "./types";

/**
 * Skeleton for the carousel products table section.
 * Includes disabled control bar and table skeleton, matching the passports table pattern.
 */
export function CarouselTableSkeleton() {
    // Create a mock table instance for the header
    const mockTable = useReactTable({
        data: [] as CarouselProductRow[],
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: {
            rowSelection: {},
        },
    });

    return (
        <div className="flex flex-col">
            {/* Disabled control bar */}
            <div className="flex items-center gap-2 mb-3">
                {/* Disabled Search */}
                <div className="relative flex items-center w-[200px]">
                    <div className="absolute left-2 pointer-events-none text-tertiary">
                        <Icons.Search className="h-4 w-4" />
                    </div>
                    <Input
                        aria-label="Search products"
                        placeholder="Search..."
                        className="pl-8 pr-3 py-[6px] h-9"
                        disabled
                    />
                </div>

                {/* Disabled Sort */}
                <Button variant="subtle" size="default" disabled>
                    <Icons.ArrowDownUp className="h-[14px] w-[14px]" />
                    <span className="px-1">Sort</span>
                </Button>

                {/* Disabled Filter */}
                <Button variant="subtle" size="default" disabled>
                    <Icons.Filter className="h-[14px] w-[14px]" />
                    <span className="px-1">Filter</span>
                </Button>
            </div>

            {/* Table skeleton */}
            <div className="overflow-hidden border border-border">
                <Table>
                    <TableHeader className="sticky top-0 z-20 border-b border-border bg-background">
                        <TableRow className="h-10 border-b border-border">
                            <TableHead className="h-10 px-4 text-left align-middle text-secondary type-small font-medium bg-background min-w-[280px]">
                                <div className="flex items-center gap-4">
                                    {/* Checkbox placeholder */}
                                    <div className="h-4 w-4 border-[1.5px] border-border bg-background" />
                                    <span className="whitespace-nowrap">Product title</span>
                                </div>
                            </TableHead>
                            <TableHead className="h-10 px-4 text-left align-middle text-secondary type-small font-medium bg-background w-[180px] min-w-[140px]">
                                Category
                            </TableHead>
                            <TableHead className="h-10 px-4 text-left align-middle text-secondary type-small font-medium bg-background w-[160px] min-w-[120px]">
                                Season
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>{/* Empty table body */}</TableBody>
                </Table>
                {/* Supabase-style skeleton bars below the header */}
                <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                </div>
            </div>
        </div>
    );
}
