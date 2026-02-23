import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type CertificationListItem =
  RouterOutputs["catalog"]["certifications"]["list"]["data"][number];
