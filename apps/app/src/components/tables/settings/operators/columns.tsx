import type { FlatTableColumn } from "@/components/tables/settings/shared";
import { countries } from "@v1/selections/countries";
import { format } from "date-fns";
import type { OperatorListItem } from "./types";

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

export const operatorColumns: Array<FlatTableColumn<OperatorListItem>> = [
  {
    id: "display_name",
    header: "Operator",
    headerClassName: "min-w-[360px]",
    cellClassName: "min-w-[360px]",
    cell: (row) => (
      <span className="block truncate type-p text-primary">{row.display_name}</span>
    ),
  },
  {
    id: "country",
    header: "Country",
    headerClassName: "w-[220px] min-w-[220px] max-w-[220px]",
    cellClassName: "w-[220px] min-w-[220px] max-w-[220px]",
    cell: (row) => (
      <span className="block truncate whitespace-nowrap type-p text-primary">
        {getCountryLabel(row.country_code)}
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
