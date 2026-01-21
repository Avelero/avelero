"use client";

import type {
  FilterState,
  SelectionState,
} from "@/components/tables/passports/types";
import { type ReactNode, createContext, useContext, useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface SelectionContextValue {
  selection: SelectionState;
  selectedCount: number;
  filterState: FilterState | undefined;
  searchValue: string;
  disabled: boolean;
  setSelection: (selection: SelectionState) => void;
  setSelectedCount: (count: number) => void;
  setFilterState: (filterState: FilterState | undefined) => void;
  setSearchValue: (value: string) => void;
  setDisabled: (disabled: boolean) => void;
}

const defaultSelection: SelectionState = {
  mode: "explicit",
  includeIds: [],
  excludeIds: [],
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<SelectionState>(defaultSelection);
  const [selectedCount, setSelectedCount] = useState(0);
  const [filterState, setFilterState] = useState<FilterState | undefined>(
    undefined,
  );
  const [searchValue, setSearchValue] = useState("");
  const [disabled, setDisabled] = useState(false);

  return (
    <SelectionContext.Provider
      value={{
        selection,
        selectedCount,
        filterState,
        searchValue,
        disabled,
        setSelection,
        setSelectedCount,
        setFilterState,
        setSearchValue,
        setDisabled,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

function useSelectionContext() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error(
      "useSelectionContext must be used within a SelectionProvider",
    );
  }
  return context;
}

// Safe version that doesn't throw (for optional usage)
export function useSelectionContextSafe() {
  return useContext(SelectionContext);
}
