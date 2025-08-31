"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMyInvitesQuery } from "@/hooks/use-invites";
import { usePrefetchCanLeaveForBrands, useUserBrandsQuery } from "@/hooks/use-brand";
import { BrandsHeader } from "./brands-header";
import { BrandsRow } from "./brands-row";
import { Skeleton } from "@v1/ui/skeleton";

type TabKey = "brands" | "invites";

export function BrandsTable() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const [tab, setTab] = useState<TabKey>("brands");
  const search = useSearchParams();
  const router = useRouter();

  const { data: brandsRes, isLoading: loadingBrands } = useUserBrandsQuery();
  const { data: invitesRes, isLoading: loadingInvites } = useMyInvitesQuery();

  const memberships = useMemo(() => (brandsRes as any)?.data ?? [], [brandsRes]);
  const invites = useMemo(() => (invitesRes as any)?.data ?? [], [invitesRes]);

  // Prefetch canLeave for better UX when opening leave modal
  usePrefetchCanLeaveForBrands(memberships.map((m: any) => m.id).filter(Boolean));

  useEffect(() => {
    const t = search?.get("tab");
    if (t === "invites" || t === "brands") setTab(t);
  }, [search]);

  const isLoading = tab === "brands" ? loadingBrands : loadingInvites;
  const rows = tab === "brands" ? memberships : invites;

  return (
    <div className="space-y-4">
      <BrandsHeader
        activeTab={tab}
        onTabChange={(t) => {
          setTab(t);
          const sp = new URLSearchParams(search ?? undefined);
          sp.set("tab", t);
          router.replace(`?${sp.toString()}`);
        }}
        locale={String(locale)}
      />

      <div className="border">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : rows.length ? (
          <div className="divide-y">
            {rows.map((row: any) => (
              <div key={row.id} className="p-3">
                {tab === "brands" ? (
                  <BrandsRow membership={row} />
                ) : (
                  <BrandsRow invite={row} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            <div className="divide-y opacity-0 select-none">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 h-14" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-p text-secondary">
                {tab === "brands" ? "You don't have any brands yet." : "There are no pending invites."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


