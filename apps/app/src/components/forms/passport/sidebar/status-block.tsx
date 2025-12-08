"use client";

import { Icons } from "@v1/ui/icons";
import { Select } from "@v1/ui/select";

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

interface StatusSectionProps {
  status: string;
  setStatus: (value: string) => void;
}

export function StatusSection({ status, setStatus }: StatusSectionProps) {
  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      <p className="type-p !font-medium text-primary">Status</p>
      <Select
        options={STATUS_OPTIONS}
        value={status}
        onValueChange={setStatus}
        placeholder="Select status"
        width="w-full min-w-[200px] max-w-[320px]"
      />
    </div> 
  );
}
