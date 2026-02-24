import type { FlatTableColumn } from "@/components/tables/settings/shared";
import { countries } from "@v1/selections/countries";
import { format } from "date-fns";
import type { ManufacturerListItem } from "./types";

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

function formatWebsite(value?: string | null) {
  if (!value) return "";

  try {
    const normalized = value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;
    const url = new URL(normalized);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export const manufacturerColumns: Array<FlatTableColumn<ManufacturerListItem>> = [
  {
    id: "name",
    header: "Manufacturer",
    headerClassName: "min-w-[320px]",
    cellClassName: "min-w-[320px]",
    cell: (row) => (
      <span className="block truncate type-p text-primary">{row.name}</span>
    ),
  },
  {
    id: "country",
    header: "Country",
    headerClassName: "w-[200px] min-w-[200px] max-w-[200px]",
    cellClassName: "w-[200px] min-w-[200px] max-w-[200px]",
    cell: (row) => (
      <span className="block truncate whitespace-nowrap type-p text-primary">
        {getCountryLabel(row.country_code)}
      </span>
    ),
  },
  {
    id: "website",
    header: "Website",
    headerClassName: "w-[220px] min-w-[220px] max-w-[220px]",
    cellClassName: "w-[220px] min-w-[220px] max-w-[220px]",
    cell: (row) => (
      <span className="block truncate whitespace-nowrap type-p text-primary">
        {formatWebsite(row.website)}
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
