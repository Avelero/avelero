import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type TagListItem = RouterOutputs["catalog"]["tags"]["list"]["data"][number];

export interface DraftTagListItem {
  id: string;
  name: string;
  hex: string | null;
  createdAt: null;
  updatedAt: null;
  products_count: number;
  __draft: true;
}

export type TagsTableRow = TagListItem | DraftTagListItem;

export function isDraftTagListItem(row: TagsTableRow): row is DraftTagListItem {
  return "__draft" in row && row.__draft === true;
}
