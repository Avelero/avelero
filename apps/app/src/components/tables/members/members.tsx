"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useUserQuery } from "@/hooks/use-user";
import { MembersHeader } from "./members-header";
import { MembersRow } from "./members-row";
import { Skeleton } from "@v1/ui/skeleton";

type TabKey = "members" | "invites";

export function MembersTable() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const [tab, setTab] = useState<TabKey>("members");
  const search = useSearchParams();
  const router = useRouter();

  const trpc = useTRPC();
  const { data: me } = useUserQuery();
  const brandId = (me as any)?.brand_id ?? null;

  const { data: membersRes, isLoading: loadingMembers } = useQuery({
    ...(trpc.brand.members.queryOptions() as any),
    enabled: typeof window !== "undefined",
  } as any);

  const { data: invitesRes, isLoading: loadingInvites } = useQuery({
    ...(trpc.brand.listInvites.queryOptions({ brand_id: brandId }) as any),
    enabled: typeof window !== "undefined" && !!brandId,
  } as any);

  const members = useMemo(() => (membersRes as any) ?? [], [membersRes]);
  const invites = useMemo(() => ((invitesRes as any)?.data ?? []) as any[], [invitesRes]);

  useEffect(() => {
    const t = search?.get("tab");
    if (t === "invites" || t === "members") setTab(t);
  }, [search]);

  const isLoading = tab === "members" ? loadingMembers : loadingInvites;
  const rows = tab === "members" ? members : invites;

  return (
    <div className="space-y-4">
      <MembersHeader
        activeTab={tab}
        onTabChange={(t) => {
          setTab(t);
          const sp = new URLSearchParams(search ?? undefined);
          sp.set("tab", t);
          router.replace(`?${sp.toString()}`);
        }}
        locale={String(locale)}
        brandId={brandId ?? undefined}
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
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : rows.length ? (
          <div className="divide-y">
            {rows.map((row: any) => (
              <div key={row.id} className="p-3">
                {tab === "members" ? (
                  <MembersRow membership={row} currentUserId={(me as any)?.id ?? null} locale={String(locale)} />
                ) : (
                  <MembersRow invite={row} locale={String(locale)} />
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
                {tab === "members" ? "No members yet." : "There are no pending invites."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


