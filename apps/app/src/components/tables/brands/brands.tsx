"use client";

import {
  usePrefetchCanLeaveForBrands,
  useUserBrandsQuery,
} from "@/hooks/use-brand";
import { useMyInvitesQuery } from "@/hooks/use-invites";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { Skeleton } from "@v1/ui/skeleton";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandsHeader } from "./brands-header";
import { BrandsRow } from "./brands-row";

type TabKey = "brands" | "invites";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type BrandList = RouterOutputs["brand"]["list"];
type MyInvites = RouterOutputs["brand"]["myInvites"];
type Membership = BrandList["data"][number];
type Invite = MyInvites["data"][number];

interface BrandWithRoleLocal {
  id: string;
  name: string;
  logo_path?: string | null;
  avatar_hue?: number | null;
  role: "owner" | "member" | null;
}

export function BrandsTable() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const [tab, setTab] = useState<TabKey>("brands");
  const search = useSearchParams();
  const router = useRouter();

  const { data: brandsRes, isLoading: loadingBrands } = useUserBrandsQuery();
  const { data: invitesRes, isLoading: loadingInvites } = useMyInvitesQuery();

  const memberships = useMemo(
    (): Membership[] => brandsRes?.data ?? [],
    [brandsRes],
  );
  const displayMemberships = useMemo(
    () =>
      memberships
        .filter(
          (m): m is Membership & { id: string; name: string } =>
            Boolean(m.id) && Boolean(m.name),
        )
        .map<BrandWithRoleLocal>((m) => ({
          id: m.id as string,
          name: m.name as string,
          logo_path: m.logo_path ?? null,
          avatar_hue: m.avatar_hue ?? null,
          role:
            m.role === "owner"
              ? "owner"
              : m.role === "member"
                ? "member"
                : null,
        })),
    [memberships],
  );
  const invitesObj = invitesRes as MyInvites | undefined;
  const invites = useMemo((): Invite[] => invitesObj?.data ?? [], [invitesObj]);
  const displayInvites = useMemo(
    () =>
      invites
        .filter(
          (
            i,
          ): i is Invite & {
            role: "owner" | "member";
            brand: { id: string; name: string };
          } =>
            (i.role === "owner" || i.role === "member") &&
            Boolean(i.brand?.id) &&
            Boolean(i.brand?.name),
        )
        .map((i) => ({
          id: i.id,
          role: i.role as "owner" | "member",
          brand: {
            id: i.brand.id as string,
            name: i.brand.name as string,
            logo_path: i.brand.logo_path ?? null,
            avatar_hue: i.brand.avatar_hue ?? null,
          },
        })),
    [invites],
  );

  // Prefetch canLeave for better UX when opening leave modal
  usePrefetchCanLeaveForBrands(
    displayMemberships
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id)),
  );

  useEffect(() => {
    const t = search?.get("tab");
    if (t === "invites" || t === "brands") setTab(t);
  }, [search]);

  const isLoading = tab === "brands" ? loadingBrands : loadingInvites;

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
            {[0, 1, 2].map((k) => (
              <div
                key={k}
                className="flex items-center justify-between p-3 border rounded"
              >
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
        ) : tab === "brands" ? (
          displayMemberships.length ? (
            <div className="divide-y">
              {displayMemberships.map((row) => (
                <div key={row.id} className="p-3">
                  <BrandsRow membership={row} />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <div className="divide-y opacity-0 select-none">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="p-3 h-14" />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-p text-secondary">
                  {"You don't have any brands yet."}
                </p>
              </div>
            </div>
          )
        ) : displayInvites.length ? (
          <div className="divide-y">
            {displayInvites.map((row) => (
              <div key={row.id} className="p-3">
                <BrandsRow invite={row} />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            <div className="divide-y opacity-0 select-none">
              {[0, 1, 2].map((k) => (
                <div key={k} className="p-3 h-14" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-p text-secondary">
                {"There are no pending invites."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
