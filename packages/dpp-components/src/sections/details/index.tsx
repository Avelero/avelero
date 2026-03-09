"use client";

/**
 * Product details sidebar section.
 *
 * Renders the product metadata as two left-aligned columns under a labeled header.
 */

import { useState } from "react";
import {
  LabeledDataTable,
  ManufacturerModal,
  ResponsiveDialog,
} from "../../components";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import { toExternalHref } from "../../lib/url-utils";
import type { Manufacturer } from "../../types/dpp-data";
import { getCountryName } from "../_transforms";
import type { SectionProps } from "../registry";

function toCapitalizedLabel(value: string): string {
  // Normalize raw attribute names into editor-friendly labels.
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function createDetailsModalSelectionGetter(
  select: ReturnType<typeof createSectionSelectionAttributes>,
) {
  // Scope modal slot ids to the details section namespace for editor selection.
  return (slotId: string) => select(`details.${slotId}`);
}

function formatManufacturerAddress(
  manufacturer: Manufacturer,
): string | undefined {
  // Collapse the manufacturer address into a multiline block for the overview modal.
  const countryName = getCountryName(manufacturer.countryCode);
  const cityStateZip = [
    manufacturer.city?.trim(),
    [manufacturer.state?.trim(), manufacturer.zip?.trim()]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const addressLines = [
    manufacturer.addressLine1?.trim(),
    manufacturer.addressLine2?.trim(),
    cityStateZip,
    countryName || undefined,
  ].filter(Boolean);

  return addressLines.length > 0 ? addressLines.join("\n") : undefined;
}

function buildManufacturerModalFacts(manufacturer: Manufacturer) {
  // Gather the available manufacturer facts into reusable modal field rows.
  const facts: Array<{ label: string; value: React.ReactNode }> = [];
  const displayName = manufacturer.name?.trim();
  const legalName = manufacturer.legalName?.trim();
  const address = formatManufacturerAddress(manufacturer);

  if (displayName && legalName && displayName !== legalName) {
    facts.push({ label: "Brand name", value: displayName });
  }

  if (manufacturer.website) {
    const manufacturerHref = toExternalHref(manufacturer.website);

    facts.push({
      label: "Website",
      value: manufacturerHref ? (
        <a
          className="underline underline-offset-4"
          href={manufacturerHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          {manufacturer.website}
        </a>
      ) : (
        manufacturer.website
      ),
    });
  }

  if (manufacturer.email) {
    facts.push({ label: "Contact", value: manufacturer.email });
  }

  if (manufacturer.phone) {
    facts.push({ label: "Phone", value: manufacturer.phone });
  }

  if (address) {
    facts.push({ label: "Address", value: address });
  }

  return facts;
}

export function DetailsSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and map the product metadata into detail rows.
  const s = resolveStyles(section.styles, tokens);
  const { productIdentifiers, productAttributes, manufacturing } = data;
  const manufacturer = manufacturing?.manufacturer;
  const manufacturerName =
    manufacturer?.legalName?.trim() || manufacturer?.name?.trim() || "";
  const [isManufacturerDialogOpen, setIsManufacturerDialogOpen] =
    useState(false);
  const borderColor =
    s.row?.borderColor ?? s.header?.borderColor ?? s.container?.borderColor;
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const headerSelection = select("details.header");
  const headingSelection = select("details.heading");
  const rowSelection = select("details.row");
  const labelSelection = select("details.label");
  const valueSelection = select("details.value");
  const modalSelect = createDetailsModalSelectionGetter(select);
  const manufacturerValueStyle = createInteractiveHoverStyle(
    {
      ...s.value,
      fontWeight: 500,
      textDecorationLine: "underline",
      textUnderlineOffset: "0.16em",
    },
    {
      color: true,
    },
  );

  const rows: Array<{
    key: string;
    label: string;
    labelProps: Record<string, string>;
    rowProps: Record<string, string>;
    value: React.ReactNode;
    valueProps?: Record<string, string>;
  }> = [];

  if (productIdentifiers.articleNumber) {
    rows.push({
      key: "article-number",
      label: "Article Number",
      labelProps: labelSelection,
      rowProps: rowSelection,
      value: (
        <span className="block truncate">
          {productIdentifiers.articleNumber}
        </span>
      ),
      valueProps: valueSelection,
    });
  }

  if (manufacturerName) {
    rows.push({
      key: "manufacturer",
      label: "Manufacturer",
      labelProps: labelSelection,
      rowProps: rowSelection,
      value: (
        <button
          {...valueSelection}
          type="button"
          className={`block w-full appearance-none cursor-pointer overflow-hidden truncate border-0 bg-transparent p-0 text-left ${INTERACTIVE_HOVER_CLASS_NAME}`}
          style={manufacturerValueStyle}
          onClick={() => setIsManufacturerDialogOpen(true)}
        >
          {manufacturerName}
        </button>
      ),
    });
  }

  if (manufacturer?.countryCode) {
    const countryName = getCountryName(manufacturer.countryCode);
    if (countryName) {
      rows.push({
        key: "country-of-origin",
        label: "Country Of Origin",
        labelProps: labelSelection,
        rowProps: rowSelection,
        value: <span className="block truncate">{countryName}</span>,
        valueProps: valueSelection,
      });
    }
  }

  if (productAttributes.category?.category) {
    rows.push({
      key: "category",
      label: "Category",
      labelProps: labelSelection,
      rowProps: rowSelection,
      value: (
        <span className="block truncate">
          {productAttributes.category.category}
        </span>
      ),
      valueProps: valueSelection,
    });
  }

  for (const [index, attr] of (productAttributes.attributes ?? [])
    .slice(0, 3)
    .entries()) {
    if (attr.value) {
      rows.push({
        key: `attribute-${attr.name}-${index}`,
        label: toCapitalizedLabel(attr.name),
        labelProps: labelSelection,
        rowProps: rowSelection,
        value: <span className="block truncate">{attr.value}</span>,
        valueProps: valueSelection,
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <ResponsiveDialog
      open={isManufacturerDialogOpen}
      onOpenChange={setIsManufacturerDialogOpen}
    >
      <div
        className={["flex flex-col w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          {...headerSelection}
          className="w-full border-b pb-xs"
          style={{ ...s.header, borderColor }}
        >
          <h2 {...headingSelection} className="w-fit" style={s.heading}>
            Details
          </h2>
        </div>

        <LabeledDataTable
          borderColor={borderColor}
          labelStyle={s.label}
          rows={rows}
          valueClassName="overflow-hidden whitespace-nowrap text-left text-ellipsis"
          valueStyle={s.value}
        />
      </div>

      {manufacturer && manufacturerName ? (
        <ManufacturerModal
          description="This manufacturer is listed as the responsible producer for this product passport."
          facts={buildManufacturerModalFacts(manufacturer)}
          select={modalSelect}
          styles={s}
          subtitle="Manufacturer overview"
          title={manufacturerName}
        />
      ) : null}
    </ResponsiveDialog>
  );
}
