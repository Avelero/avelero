"use client";

import { ExportProductsModal } from "@/components/modals/export-products-modal";
import { useSelectionContextSafe } from "@/components/passports/selection-context";

/**
 * Client wrapper for the Export button in the layout header.
 * Reads selection state from the SelectionContext and passes it to the ExportProductsModal.
 */
export function ExportButton() {
  const context = useSelectionContextSafe();

  // If no context (provider not mounted yet), show disabled button
  if (!context) {
    return (
      <ExportProductsModal
        selection={{ mode: "explicit", includeIds: [], excludeIds: [] }}
        selectedCount={0}
        filterState={undefined}
        searchValue=""
        disabled
      />
    );
  }

  return (
    <ExportProductsModal
      selection={context.selection}
      selectedCount={context.selectedCount}
      filterState={context.filterState}
      searchValue={context.searchValue}
      disabled={context.disabled}
    />
  );
}
