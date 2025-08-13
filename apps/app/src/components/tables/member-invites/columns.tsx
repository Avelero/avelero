import { useTRPC } from "@/trpc/client";
import { Avatar, AvatarFallback } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import type { ColumnDef, FilterFn, Row } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface TeamInviteRow {
  id: string;
  email: string;
  role: "owner" | "member" | null;
  status: string;
}

const emailFilterFn: FilterFn<TeamInviteRow> = (
  row: Row<TeamInviteRow>,
  _columnId: string,
  filterValue: string,
) => {
  const email = row.original.email?.toLowerCase() ?? "";
  return email.includes((filterValue ?? "").toLowerCase());
};

export const columns: ColumnDef<TeamInviteRow>[] = [
  {
    id: "email",
    accessorKey: "email",
    filterFn: emailFilterFn,
    header: () => null,
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-4">
          <Avatar className="rounded-full w-8 h-8">
            <AvatarFallback>
              <span className="text-xs">
                {row.original.email?.slice(0, 1)?.toUpperCase() ?? "P"}
              </span>
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">Pending Invitation</span>
            <span className="text-sm text-[#606060]">{row.original.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => null,
    cell: ({ row }) => {
      const trpc = useTRPC();
      const queryClient = useQueryClient();

      const revoke = useMutation(
        trpc.brand.revokeInvite.mutationOptions({
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: trpc.brand.listInvites.queryKey(),
            });
          },
        }),
      );

      return (
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[#606060]">
            {(row.original.role ?? "member") === "owner" ? "Owner" : "Member"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => revoke.mutate({ invite_id: row.original.id })}
          >
            Remove
          </Button>
        </div>
      );
    },
    meta: { className: "text-right w-full" },
  },
];


