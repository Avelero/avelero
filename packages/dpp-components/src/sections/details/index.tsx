"use client";

/**
 * Product details sidebar section.
 *
 * Renders the product metadata as two left-aligned columns under a labeled header.
 */

import { useState } from "react";
import { DataTable, ManufacturerModal, Modal } from "../../components";
import { ModalLink } from "../../components/modal";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { useHapticTap } from "../../lib/haptics";
import { INTERACTIVE_HOVER_CLASS_NAME } from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import { createUnderlinedActionStyle } from "../../lib/underlined-action";
import { toExternalHref } from "../../lib/url-utils";
import type { Manufacturer } from "../../types/data";
import type { CustomFont } from "../../types/passport";
import type { SectionProps } from "../registry";
import { getCountryName } from "../transforms";

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

function buildManufacturerModalFacts(
  manufacturer: Manufacturer,
  modalStyles: Record<string, React.CSSProperties>,
  customFonts?: CustomFont[],
) {
  // Gather the available manufacturer facts into reusable modal field rows.
  const facts: Array<{ key: string; label: string; value: React.ReactNode }> =
    [];
  const displayName = manufacturer.name?.trim();
  const legalName = manufacturer.legalName?.trim();

  if (displayName) {
    facts.push({ key: "Name", label: "Name", value: displayName });
  }

  if (legalName && legalName !== displayName) {
    facts.push({ key: "Legal name", label: "Legal name", value: legalName });
  }

  if (manufacturer.website) {
    const manufacturerHref = toExternalHref(manufacturer.website);

    facts.push({
      key: "Website",
      label: "Website",
      value: manufacturerHref ? (
        <ModalLink
          customFonts={customFonts}
          href={manufacturerHref}
          rel="noopener noreferrer"
          styles={modalStyles}
          target="_blank"
        >
          {manufacturer.website}
        </ModalLink>
      ) : (
        manufacturer.website
      ),
    });
  }

  if (manufacturer.email) {
    facts.push({ key: "Email", label: "Email", value: manufacturer.email });
  }

  if (manufacturer.phone) {
    facts.push({ key: "Phone", label: "Phone", value: manufacturer.phone });
  }

  if (manufacturer.city) {
    facts.push({ key: "City", label: "City", value: manufacturer.city });
  }

  if (manufacturer.countryCode) {
    facts.push({
      key: "Country",
      label: "Country",
      value:
        getCountryName(manufacturer.countryCode) || manufacturer.countryCode,
    });
  }

  return facts;
}

function buildManufacturerMapQuery(
  manufacturer: Manufacturer,
  showExactLocation: boolean,
): string | null {
  // Collapse the manufacturer address into either an exact or city-level Google Maps query.
  const country = manufacturer.countryCode
    ? getCountryName(manufacturer.countryCode) ?? manufacturer.countryCode
    : undefined;
  const queryParts = (
    showExactLocation
      ? [
          manufacturer.addressLine1,
          manufacturer.city,
          manufacturer.state,
          manufacturer.zip,
          country,
        ]
      : [manufacturer.city, country]
  )
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (queryParts.length === 0) {
    return null;
  }

  return queryParts.join(", ");
}

export function DetailsSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
  modalContent,
  modalStyles,
  forceModalType,
}: SectionProps) {
  // Resolve styles and map the product metadata into detail rows.
  const s = resolveStyles(section.styles, tokens);
  const isForceOpen = forceModalType === "details";
  const { productIdentifiers, productAttributes, manufacturing } = data;
  const manufacturer = manufacturing?.manufacturer;
  const manufacturerName =
    manufacturer?.legalName?.trim() || manufacturer?.name?.trim() || "";
  const [isManufacturerDialogOpen, setIsManufacturerDialogOpen] =
    useState(false);
  const hapticTap = useHapticTap();
  const borderColor =
    s.row?.borderColor ?? s.header?.borderColor ?? s.container?.borderColor;
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("details");
  const showExactLocation = modalContent?.showExactLocation !== false;
  const manufacturerValueStyle = createUnderlinedActionStyle(
    {
      ...s.value,
      color: tokens.colors.link,
    },
    { customFonts: tokens.fonts, defaultColor: tokens.colors.link },
  );

  const rows: Array<{
    key: string;
    label: string;
    value: React.ReactNode;
  }> = [];

  if (productIdentifiers.articleNumber) {
    rows.push({
      key: "article-number",
      label: "Article Number",
      value: (
        <span className="block truncate">
          {productIdentifiers.articleNumber}
        </span>
      ),
    });
  }

  if (manufacturerName) {
    rows.push({
      key: "manufacturer",
      label: "Manufacturer",
      value: (
        <button
          type="button"
          className={`max-w-full cursor-pointer appearance-none overflow-hidden whitespace-nowrap border-0 bg-transparent p-0 text-left text-ellipsis ${INTERACTIVE_HOVER_CLASS_NAME}`}
          style={manufacturerValueStyle}
          onClick={() => {
            hapticTap();
            setIsManufacturerDialogOpen(true);
          }}
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
        value: <span className="block truncate">{countryName}</span>,
      });
    }
  }

  if (productAttributes.category?.category) {
    rows.push({
      key: "category",
      label: "Category",
      value: (
        <span className="block truncate">
          {productAttributes.category.category}
        </span>
      ),
    });
  }

  for (const [index, attr] of (productAttributes.attributes ?? [])
    .slice(0, 3)
    .entries()) {
    if (attr.value) {
      rows.push({
        key: `attribute-${attr.name}-${index}`,
        label: toCapitalizedLabel(attr.name),
        value: <span className="block truncate">{attr.value}</span>,
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <Modal
      open={isManufacturerDialogOpen || isForceOpen}
      onOpenChange={setIsManufacturerDialogOpen}
      modal={!isForceOpen}
    >
      <div
        {...rootSelection}
        className={["flex flex-col w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className="w-full border-b pb-xs"
          style={{ ...s.header, borderColor }}
        >
          <h2 className="w-fit" style={s.heading}>
            Details
          </h2>
        </div>

        <DataTable
          borderColor={borderColor}
          labelStyle={s.label}
          rows={rows}
          valueClassName="overflow-hidden whitespace-nowrap text-left text-ellipsis"
          valueStyle={s.value}
        />
      </div>

      {manufacturer && manufacturerName ? (
        <ManufacturerModal
          customFonts={tokens.fonts}
          description="This manufacturer is listed as the responsible producer for this product passport."
          facts={buildManufacturerModalFacts(
            manufacturer,
            modalStyles ?? {},
            tokens.fonts,
          )}
          mapQuery={buildManufacturerMapQuery(manufacturer, showExactLocation)}
          styles={modalStyles ?? {}}
          subtitle="Manufacturer overview"
          title={manufacturerName}
        />
      ) : null}
    </Modal>
  );
}
