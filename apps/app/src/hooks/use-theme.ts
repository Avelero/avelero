"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Passport } from "@v1/dpp-components";

export interface BrandTheme {
  passport: Passport;
  updatedAt: string | null;
}

export function useThemeQuery() {
  const trpc = useTRPC();
  const query = useSuspenseQuery(trpc.brand.theme.get.queryOptions());

  return {
    ...query,
    data: {
      passport: (query.data.passport ?? {}) as Passport,
      updatedAt: query.data.updatedAt,
    } satisfies BrandTheme,
  };
}
