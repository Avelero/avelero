"use client";

import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { Skeleton } from "@v1/ui/skeleton";
import { useMemo, useState } from "react";
import { MembersHeader } from "./members-header";
import { MembersRow } from "./members-row";

type TabKey = "members" | "invites";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export function MembersTable() {
  const [tab, setTab] = useState<TabKey>("members");

  const trpc = useTRPC();
  const { data: me } = useUserQuery();
  type CurrentUserLike = { id: string; brand_id: string | null };
  const meUser = (me as unknown as CurrentUserLike | null | undefined) ?? null;
  const brandId = meUser?.brand_id ?? null;

  if (!brandId) {
    return (
      <div className="space-y-4">
        <MembersHeader
          activeTab="members"
          onTabChange={() => undefined}
          brandId={undefined}
        />
        <div className="border p-6">
          <p className="type-p text-secondary">
            Select or create a brand to manage members.
          </p>
        </div>
      </div>
    );
  }

  const compositeOptions = useMemo(() => {
    return trpc.composite.membersWithInvites.queryOptions({});
  }, [trpc]);

  const { data: compositeRes } = useSuspenseQuery(compositeOptions);

  type MembersWithInvites = RouterOutputs["composite"]["membersWithInvites"];
  type MemberItem = MembersWithInvites["members"][number];
  type InviteItem = MembersWithInvites["invites"][number];

  const members = useMemo<MemberItem[]>(
    () =>
      Array.isArray(compositeRes?.members)
        ? (compositeRes?.members as MemberItem[])
        : [],
    [compositeRes],
  );
  const invites = useMemo<InviteItem[]>(() => {
    const list = compositeRes?.invites;
    return Array.isArray(list) ? (list as InviteItem[]) : [];
  }, [compositeRes]);

  const isLoading = false;
  const rows = tab === "members" ? members : invites;

  return (
    <div className="space-y-4">
      <MembersHeader
        activeTab={tab}
        onTabChange={(t) => {
          setTab(t);
        }}
        brandId={brandId ?? undefined}
      />

      <div className="border">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {(["a", "b", "c"] as const).map((key) => (
              <div
                key={`members-skel-${key}`}
                className="flex items-center justify-between p-3 border rounded"
              >
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
            {rows.map((row, index) => (
              <div
                key={
                  tab === "members"
                    ? (row as MemberItem).user_id ??
                      (row as MemberItem).email ??
                      `member-fallback-${index}`
                    : (row as InviteItem).id
                }
                className="p-3"
              >
                {tab === "members" ? (
                  <MembersRow
                    brandId={brandId}
                    membership={row as MemberItem}
                    currentUserId={meUser?.id ?? null}
                  />
                ) : (
                  <MembersRow brandId={brandId} invite={row as InviteItem} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            <div className="divide-y opacity-0 select-none">
              {["a", "b", "c"].map((key) => (
                <div key={`members-empty-${key}`} className="p-3 h-14" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="type-p text-secondary">
                {tab === "members"
                  ? "No members yet."
                  : "There are no pending invites."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
