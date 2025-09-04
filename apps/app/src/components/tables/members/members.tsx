"use client";

import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Skeleton } from "@v1/ui/skeleton";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MembersHeader } from "./members-header";
import { MembersRow } from "./members-row";

type TabKey = "members" | "invites";

export function MembersTable() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const [tab, setTab] = useState<TabKey>("members");
  const search = useSearchParams();
  const router = useRouter();

  const trpc = useTRPC();
  const { data: me } = useUserQuery();
  type CurrentUserLike = { id: string; brand_id: string | null };
  const meUser = (me as unknown as CurrentUserLike | null | undefined) ?? null;
  const brandId = meUser?.brand_id ?? null;

  const membersOptions = useMemo(
    () => ({
      ...trpc.brand.members.queryOptions(),
      enabled: typeof window !== "undefined",
    }),
    [trpc],
  );
  const { data: membersRes, isLoading: loadingMembers } =
    useQuery(membersOptions);

  const invitesOptions = useMemo(
    () => ({
      ...trpc.brand.listInvites.queryOptions({
        brand_id: brandId ?? "00000000-0000-0000-0000-000000000000",
      }),
      enabled: typeof window !== "undefined" && !!brandId,
    }),
    [trpc, brandId],
  );
  const { data: invitesRes, isLoading: loadingInvites } =
    useQuery(invitesOptions);

  interface MemberItem {
    id: string;
    role: "owner" | "member" | null;
    user: {
      id: string | null;
      email: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      avatarHue?: number | null;
    } | null;
    created_at?: string | null;
  }
  interface InviteItem {
    id: string;
    email: string;
    role: "owner" | "member";
    expires_at: string | null;
    created_at: string | null;
  }
  const members = useMemo<MemberItem[]>(
    () => (Array.isArray(membersRes) ? (membersRes as MemberItem[]) : []),
    [membersRes],
  );
  const invites = useMemo<InviteItem[]>(() => {
    const inv = (invitesRes as { data?: unknown } | undefined)?.data;
    return Array.isArray(inv) ? (inv as InviteItem[]) : [];
  }, [invitesRes]);

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
            {rows.map((row) => (
              <div key={(row as { id: string }).id} className="p-3">
                {tab === "members" ? (
                  <MembersRow
                    membership={row as MemberItem}
                    currentUserId={meUser?.id ?? null}
                    locale={String(locale)}
                  />
                ) : (
                  <MembersRow
                    invite={row as InviteItem}
                    locale={String(locale)}
                  />
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
              <p className="text-p text-secondary">
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
