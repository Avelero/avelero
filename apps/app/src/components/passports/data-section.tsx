"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DataCard, DataCardSkeleton } from "../data-card";

const CARD_CONFIG = [
  { key: "published", title: "Published" },
  { key: "scheduled", title: "Scheduled" },
  { key: "unpublished", title: "Unpublished" },
  { key: "archived", title: "Archived" },
] as const;

export function DataSectionContent() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.summary.productStatus.queryOptions(),
  );

  const counts = {
    published: data?.data?.published ?? 0,
    scheduled: data?.data?.scheduled ?? 0,
    unpublished: data?.data?.unpublished ?? 0,
    archived: data?.data?.archived ?? 0,
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
