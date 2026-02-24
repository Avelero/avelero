import type { FlatTableColumn } from "@/components/tables/settings/shared";
import { format } from "date-fns";
import type { CertificationListItem } from "./types";

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMM yyyy");
}

function formatCertificationLabel(row: CertificationListItem) {
  const title = row.title?.trim() ?? "";
  const code = row.certification_code?.trim() ?? "";
  if (title && code) return `${title} (${code})`;
  return title || code || "";
}

export const certificationColumns: Array<FlatTableColumn<CertificationListItem>> = [
  {
    id: "title",
    header: "Certification",
    headerClassName: "min-w-[340px]",
    cellClassName: "min-w-[340px]",
    cell: (row) => (
      <span className="block truncate type-p text-primary">
        {formatCertificationLabel(row)}
      </span>
    ),
  },
  {
    id: "institute_name",
    header: "Institute",
    headerClassName: "w-[260px] min-w-[260px] max-w-[260px]",
    cellClassName: "w-[260px] min-w-[260px] max-w-[260px]",
    cell: (row) => (
      <span className="block truncate whitespace-nowrap type-p text-primary">
        {row.institute_name ?? ""}
      </span>
    ),
  },
  {
    id: "materials_count",
    header: "Materials",
    headerClassName: "w-[120px] min-w-[120px] max-w-[120px]",
    cellClassName: "w-[120px] min-w-[120px] max-w-[120px]",
    cell: (row) => (
      <span className="whitespace-nowrap type-p text-primary">
        {row.materials_count ?? 0}
      </span>
    ),
  },
  {
    id: "expiry_date",
    header: "Expiry",
    headerClassName: "w-[180px] min-w-[180px] max-w-[180px]",
    cellClassName: "w-[180px] min-w-[180px] max-w-[180px]",
    cell: (row) => (
      <span className="whitespace-nowrap type-p text-primary">
        {formatDate(row.expiry_date)}
      </span>
    ),
  },
  {
    id: "created_at",
    header: "Created",
    headerClassName: "w-[240px] min-w-[240px] max-w-[240px]",
    cellClassName: "w-[240px] min-w-[240px] max-w-[240px]",
    cell: (row) => (
      <span className="whitespace-nowrap type-p text-primary">
        {formatDate(row.created_at)}
      </span>
    ),
  },
];
