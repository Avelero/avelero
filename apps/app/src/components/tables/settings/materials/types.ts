import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type MaterialListItem =
  RouterOutputs["catalog"]["materials"]["list"]["data"][number];

export type MaterialTableRow = MaterialListItem & {
  certification_title?: string | null;
  certification_code?: string | null;
};
