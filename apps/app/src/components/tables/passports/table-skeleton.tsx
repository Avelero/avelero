"use client";

import { Skeleton } from "@v1/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@v1/ui/table";

export function PassportTableSkeleton({ rows = 16 }: { rows?: number }) {
  const placeholders = Array.from({ length: rows });

  return (
    <div className="w-full">
      <div className="overflow-x-auto border-l border-r border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell className="w-[48px]">
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell className="min-w-[240px]">
                <Skeleton className="h-5 w-28" />
              </TableCell>
              <TableCell className="min-w-[140px]">
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell className="min-w-[220px]">
                <Skeleton className="h-5 w-24" />
              </TableCell>
              <TableCell className="min-w-[180px]">
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell className="min-w-[140px]">
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="min-w-[220px]">
                <Skeleton className="h-5 w-28" />
              </TableCell>
              <TableCell className="w-[220px] text-right">
                <Skeleton className="h-5 w-24 ml-auto" />
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {placeholders.map((_, i) => (
              <TableRow key={i.toString()} className="h-[56px]">
                <TableCell className="w-[48px]">
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell className="min-w-[240px]">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[120px]" />
                  </div>
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-4 w-[80px]" />
                  </div>
                </TableCell>
                <TableCell className="min-w-[220px]">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[32px]" />
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                </TableCell>
                <TableCell className="min-w-[180px]">
                  <Skeleton className="h-4 w-[100px]" />
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <Skeleton className="h-6 w-[56px]" />
                </TableCell>
                <TableCell className="min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-6 w-[140px]" />
                  </div>
                </TableCell>
                <TableCell className="w-[220px]">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-[110px]" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
