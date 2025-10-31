"use client";

import {
  usePrefetchCanLeaveForBrands,
  useUserBrandsQuerySuspense,
} from "@/hooks/use-brand";
import { useMyInvitesQuerySuspense } from "@/hooks/use-invites";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { Skeleton } from "@v1/ui/skeleton";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BrandsHeader } from "./brands-header";
import { BrandsRow } from "./brands-row";

type TabKey = "brands" | "invites";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type BrandList = RouterOutputs["brand"]["list"];
type MyInvites = RouterOutputs["v2"]["user"]["invites"]["list"];
type Membership = BrandList["data"][number];
type Invite = MyInvites[number];

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

  const { data: brandsRes } = useUserBrandsQuerySuspense();
  const { data: invitesRes } = useMyInvitesQuerySuspense();

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
  const invites = useMemo((): Invite[] => invitesRes ?? [], [invitesRes]);
  const displayInvites = useMemo(
    () =>
      invites
        .filter(
          (i): i is Invite & { role: "owner" | "member"; brand_name: string } =>
            (i.role === "owner" || i.role === "member") &&
            Boolean(i.brand_name),
        )
        .map((i) => ({
          id: i.id,
          role: i.role as "owner" | "member",
          brand_name: i.brand_name as string,
          brand_logo: i.brand_logo ?? null,
        })),
    [invites],
  );

  // Prefetch canLeave for better UX when opening leave modal
  usePrefetchCanLeaveForBrands(
    displayMemberships
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id)),
  );

  // Local-only tab state: no URL or router coupling

  return (
    <div className="space-y-4">
      <BrandsHeader
        activeTab={tab}
        onTabChange={(t) => {
          setTab(t);
        }}
        locale={String(locale)}
      />

      <div className="border">
        {tab === "brands" ? (
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
                <p className="type-p text-secondary">
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
              <p className="type-p text-secondary">
                {"There are no pending invites."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
