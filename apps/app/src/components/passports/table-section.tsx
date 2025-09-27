"use client";

import { PassportDataTable } from "../tables/passports";
import * as React from "react";
import { PassportControls } from "./passport-controls";

export function TableSection() {
  const [selectedCount, setSelectedCount] = React.useState(0);
  return (
    <div className="w-full">
      <PassportControls selectedCount={selectedCount} />
      <PassportDataTable onSelectionChangeAction={setSelectedCount} />
    </div>
  );
}
