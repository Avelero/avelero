import type { FlatTableColumn } from "@/components/tables/settings/shared";
import { countries } from "@v1/selections/countries";
import { format } from "date-fns";
import type { MaterialTableRow } from "./types";

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMM yyyy");
}

function getCountryLabel(code?: string | null) {
  if (!code) return "";
  const country = countries[code as keyof typeof countries];
  return country?.name ?? code;
}

function formatCertification(row: MaterialTableRow) {
  const title = row.certification_title?.trim();
  const code = row.certification_code?.trim();
  if (title && code) return `${title} (${code})`;
  return title || code || "";
}

function formatRecyclable(value?: boolean | null) {
  if (value == null) return "";
  return value ? "Yes" : "No";
}

export const materialColumns: Array<FlatTableColumn<MaterialTableRow>> = [
  {
    id: "name",
    header: "Material",
    headerClassName: "min-w-[280px]",
    cellClassName: "min-w-[280px]",
    cell: (row) => (
      <span className="block truncate type-p text-primary">{row.name}</span>
    ),
  },
  {
    id: "certification",
    header: "Certification",
    headerClassName: "w-[280px] min-w-[280px] max-w-[280px]",
    cellClassName: "w-[280px] min-w-[280px] max-w-[280px]",
    cell: (row) => (
      <span className="block truncate whitespace-nowrap type-p text-primary">
        {formatCertification(row)}
      </span>
    ),
  },
  {
    id: "country_of_origin",
    header: "Origin",
    headerClassName: "w-[180px] min-w-[180px] max-w-[180px]",
    cellClassName: "w-[180px] min-w-[180px] max-w-[180px]",
    cell: (row) => (
      <span className="block truncate whitespace-nowrap type-p text-primary">
        {getCountryLabel(row.country_of_origin)}
      </span>
    ),
  },
  {
    id: "recyclable",
    header: "Recyclable",
    headerClassName: "w-[140px] min-w-[140px] max-w-[140px]",
    cellClassName: "w-[140px] min-w-[140px] max-w-[140px]",
    cell: (row) => (
      <span className="whitespace-nowrap type-p text-primary">
        {formatRecyclable(row.recyclable)}
      </span>
    ),
  },
  {
    id: "products_count",
    header: "Products",
    headerClassName: "w-[120px] min-w-[120px] max-w-[120px]",
    cellClassName: "w-[120px] min-w-[120px] max-w-[120px]",
    cell: (row) => (
      <span className="whitespace-nowrap type-p text-primary">
        {row.products_count ?? 0}
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
