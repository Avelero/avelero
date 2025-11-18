"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { DataCard } from "../data-card";

export function DataSection() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.summary.productStatus.queryOptions());

  const counts = {
    published: data?.data?.published ?? 0,
    scheduled: data?.data?.scheduled ?? 0,
    unpublished: data?.data?.unpublished ?? 0,
    archived: data?.data?.archived ?? 0,
  };
  return (
    <div className="flex flex-row gap-6">
      <DataCard title="Published" value={counts.published} />
      <DataCard title="Scheduled" value={counts.scheduled} />
      <DataCard title="Unpublished" value={counts.unpublished} />
      <DataCard title="Archived" value={counts.archived} />
    </div>
  );
}
