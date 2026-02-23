import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type AttributeGroupListItem =
  RouterOutputs["catalog"]["attributes"]["listGrouped"]["data"][number];

export type AttributeValueListItem = AttributeGroupListItem["values"][number];
