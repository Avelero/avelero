"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DataCard, DataCardSkeleton } from "../data-card";

const CARD_CONFIG = [
  { key: "total", title: "Total Passports" },
  { key: "published", title: "Published" },
  { key: "unpublished", title: "Unpublished" },
  { key: "scheduled", title: "Scheduled" },
] as const;

export function DataSection() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.summary.productStatus.queryOptions());

  const counts = {
    total: data?.data?.total ?? 0,
    published: data?.data?.published ?? 0,
    unpublished: data?.data?.unpublished ?? 0,
    scheduled: data?.data?.scheduled ?? 0,
  };

  return (
    <div className="flex flex-row gap-6">
      {CARD_CONFIG.map(({ key, title }) => (
        <DataCard key={key} title={title} value={counts[key]} />
      ))}
    </div>
  );
}

export function DataSectionSkeleton() {
  return (
    <div className="flex flex-row gap-6">
      {CARD_CONFIG.map(({ key, title }) => (
        <DataCardSkeleton key={key} title={title} />
      ))}
    </div>
  );
}
