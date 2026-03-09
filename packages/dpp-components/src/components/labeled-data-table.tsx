"use client";

/**
 * Reusable labeled data table for sidebar details and modal summaries.
 */

import { cn } from "@v1/ui/cn";
import type * as React from "react";

export interface LabeledDataTableRow {
  key: string;
  label: React.ReactNode;
  labelProps?: React.HTMLAttributes<HTMLDivElement>;
  rowProps?: React.HTMLAttributes<HTMLDivElement>;
  value: React.ReactNode;
  valueProps?: React.HTMLAttributes<HTMLDivElement>;
}

interface LabeledDataTableProps {
  borderColor?: string;
  className?: string;
  gridTemplateColumns?: string;
  labelClassName?: string;
  labelStyle?: React.CSSProperties;
  rows: LabeledDataTableRow[];
  rowClassName?: string;
  rowStyle?: React.CSSProperties;
  valueClassName?: string;
  valueStyle?: React.CSSProperties;
}

export function LabeledDataTable({
  borderColor,
  className,
  gridTemplateColumns = "minmax(120px,max-content)_minmax(0,1fr)",
  labelClassName,
  labelStyle,
  rows,
  rowClassName,
  rowStyle,
  valueClassName,
  valueStyle,
}: LabeledDataTableProps) {
  // Render a reusable two-column label/value table with section-provided styles.
  return (
    <div
      className={cn("grid w-full min-w-0", className)}
      style={{ gridTemplateColumns }}
    >
      {rows.map((row) => {
        const {
          className: nextRowClassName,
          style: nextRowStyle,
          ...rowRestProps
        } = row.rowProps ?? {};
        const {
          className: nextLabelClassName,
          style: nextLabelStyle,
          ...labelRestProps
        } = row.labelProps ?? {};
        const {
          className: nextValueClassName,
          style: nextValueStyle,
          ...valueRestProps
        } = row.valueProps ?? {};

        return (
          <div
            key={row.key}
            className={cn(
              "col-span-2 grid min-w-0 border-b py-sm",
              rowClassName,
              nextRowClassName,
            )}
            style={{
              borderColor,
              gridTemplateColumns: "subgrid",
              ...rowStyle,
              ...nextRowStyle,
            }}
            {...rowRestProps}
          >
            <div className="min-w-0 pr-4">
              <div
                className={cn(
                  "min-w-[120px] whitespace-nowrap",
                  labelClassName,
                  nextLabelClassName,
                )}
                style={{
                  ...labelStyle,
                  ...nextLabelStyle,
                }}
                {...labelRestProps}
              >
                {row.label}
              </div>
            </div>

            <div className="min-w-0">
              <div
                className={cn("min-w-0", valueClassName, nextValueClassName)}
                style={{
                  ...valueStyle,
                  ...nextValueStyle,
                }}
                {...valueRestProps}
              >
                {row.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
