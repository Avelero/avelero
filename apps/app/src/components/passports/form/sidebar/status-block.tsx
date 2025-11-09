"use client";

import { usePassportFormContext } from "@/components/passports/form/context/passport-form-context";
import { Icons } from "@v1/ui/icons";
import { Select } from "@v1/ui/select";

const STATUS_OPTIONS = [
  {
    value: "draft",
    label: "Draft",
    icon: <Icons.StatusUnpublished width={14} height={14} />,
  },
  {
    value: "in_progress",
    label: "In Progress",
    icon: <Icons.StatusScheduled width={14} height={14} />,
  },
  {
    value: "published",
    label: "Published",
    icon: <Icons.StatusPublished width={14} height={14} />,
  },
];

export function StatusSection() {
  const { formState, updateField } = usePassportFormContext();

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      <p className="type-p !font-medium text-primary">Status</p>
      <Select
        options={STATUS_OPTIONS}
        value={formState.status}
        onValueChange={(value) => updateField("status", value as "draft" | "in_progress" | "published")}
        placeholder="Select status"
        width="w-[216px]"
      />
    </div>
  );
}
