"use client";

import { useState } from "react";
import type { Table } from "@tanstack/react-table";
import { Input } from "@v1/ui/input";
import { Button } from "@v1/ui/button";
import { InviteModal } from "@/components/modals/invite-modal";

interface Props<TData> {
  brandId: string;
  table?: Table<TData>;
}

export function DataTableHeader<TData>({ brandId, table }: Props<TData>) {
  const [search, setSearch] = useState(
    (table?.getColumn("email")?.getFilterValue() as string) ?? "",
  );

  function onSearchChange(value: string) {
    setSearch(value);
    table?.getColumn("email")?.setFilterValue(value);
  }

  return (
    <div className="flex items-center pb-4 gap-4">
      <Input
        className="flex-1"
        placeholder="Search by email..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <InviteModal brandId={brandId} />
      <Button
        variant="outline"
        onClick={() => {
          onSearchChange("");
        }}
      >
        Clear
      </Button>
    </div>
  );
}


