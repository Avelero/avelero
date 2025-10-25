"use client";

import { Select } from "@v1/ui/select";
import { Icons } from "@v1/ui/icons";
import { useState } from "react";

const STATUS_OPTIONS = [
  {
    value: "published",
    label: "Published",
    icon: <Icons.StatusPublished width={14} height={14} />,
  },
  {
    value: "unpublished",
    label: "Unpublished",
    icon: <Icons.StatusUnpublished width={14} height={14} />,
  },
  {
    value: "archived",
    label: "Archived",
    icon: <Icons.StatusArchived width={14} height={14} />,
  },
  {
    value: "scheduled",
    label: "Scheduled",
    icon: <Icons.StatusScheduled width={14} height={14} />,
  },
];

/**
 * Renders a labeled status selector used in the passport form sidebar.
 *
 * Displays a "Status" label and a Select control populated with predefined status options; the component holds and updates the selected status in local state (initial value "published").
 *
 * @returns The rendered StatusSection UI element.
 */
export function StatusSection() {
  const [status, setStatus] = useState<string>("published");

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      <p className="type-p !font-medium text-primary">Status</p>
      <Select
        options={STATUS_OPTIONS}
        value={status}
        onValueChange={setStatus}
        placeholder="Select status"
        width="w-[216px]"
      />
    </div>
  );
}