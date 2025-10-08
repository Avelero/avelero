"use client";

import { useUserQuerySuspense } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { DataCard } from "../data-card";

export function DataSection() {
  const trpc = useTRPC();
  const { data: user } = useUserQuerySuspense();
  const brandId = (user as any)?.brand_id as string | null | undefined;
  
  // Use the original query options but add brandId to dependencies via useMemo
  const { data } = useQuery(
    React.useMemo(
      () => trpc.passports.countByStatus.queryOptions(),
      [trpc, brandId] // brandId as dependency ensures re-fetch when brand changes
    )
  );

  // Debug logging
  React.useEffect(() => {
  console.log('DEBUG - DataSection:', {
      brandId,
      data,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
    });
  }, [brandId, data]);
  
  const counts = (data as
    | {
        published: number;
        scheduled: number;
        unpublished: number;
        archived: number;
      }
    | undefined) ?? {
    published: 0,
    scheduled: 0,
    unpublished: 0,
    archived: 0,
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
