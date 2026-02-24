import type { FlatTableColumn } from "@/components/tables/settings/shared";
import { format } from "date-fns";
import type { SeasonListItem } from "./types";

function formatMonthYear(dateValue?: string | Date | null) {
  if (!dateValue) return null;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "MMM yyyy");
}

function formatDateRange(row: SeasonListItem) {
  if (row.ongoing) return "Ongoing";

  const start = formatMonthYear(row.startDate ?? null);
  const end = formatMonthYear(row.endDate ?? null);

  if (start && end) return `${start} to ${end}`;
  if (start) return start;
  if (end) return end;
  return "";
}

function formatCreatedDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMM yyyy");
}

export const seasonColumns: Array<FlatTableColumn<SeasonListItem>> = [
  {
    id: "name",
    header: "Season",
    headerClassName: "min-w-[320px]",
    cellClassName: "min-w-[320px]",
    cell: (row) => <span className="type-p text-primary truncate block">{row.name}</span>,
  },
  {
    id: "date_range",
    header: "Date range",
    headerClassName: "w-[280px] min-w-[280px] max-w-[280px]",
    cellClassName: "w-[280px] min-w-[280px] max-w-[280px]",
    cell: (row) => <span className="type-p text-primary whitespace-nowrap">{formatDateRange(row)}</span>,
  },
  {
    id: "products_count",
    header: "Products",
    headerClassName: "w-[120px] min-w-[120px] max-w-[120px]",
    cellClassName: "w-[120px] min-w-[120px] max-w-[120px]",
    cell: (row) => <span className="type-p text-primary whitespace-nowrap">{row.products_count ?? 0}</span>,
  },
  {
    id: "created_at",
    header: "Created",
    headerClassName: "w-[240px] min-w-[240px] max-w-[240px]",
    cellClassName: "w-[240px] min-w-[240px] max-w-[240px]",
    cell: (row) => <span className="type-p text-primary whitespace-nowrap">{formatCreatedDate(row.createdAt)}</span>,
  },
];
