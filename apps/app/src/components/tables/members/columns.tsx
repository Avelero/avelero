import { Avatar, AvatarFallback } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, FilterFn, Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

interface MemberRow {
  id: string;
  teamId: string;
  role: "owner" | "member" | null;
  user: { id: string | null; email: string | null; fullName: string | null; avatarUrl: string | null } | null;
}

const userFilterFn: FilterFn<MemberRow> = (row: Row<MemberRow>, _columnId: string, filterValue: string) => {
  const memberName = row.original.user?.fullName?.toLowerCase();
  return (memberName ?? "").includes((filterValue ?? "").toLowerCase());
};

export const columns: ColumnDef<MemberRow>[] = [
  {
    id: "user",
    accessorKey: "user.fullName",
    filterFn: userFilterFn,
    cell: ({ row }) => {
      return (
        <div className="flex items-center space-x-4">
          <Avatar className="rounded-full w-8 h-8">
            <AvatarFallback>
              <span className="text-xs">{row.original.user?.fullName?.charAt(0)?.toUpperCase()}</span>
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{row.original.user?.fullName}</span>
            <span className="text-sm text-[#606060]">{row.original.user?.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const trpc = useTRPC();
      const queryClient = useQueryClient();
      const revoke = useMutation(
        trpc.brand.revokeInvite.mutationOptions({
          onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.brand.members.queryKey() }),
        }),
      );
      return (
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[#606060]">{(row.original.role ?? "member") === "owner" ? "Owner" : "Member"}</span>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revoke.mutate({ invite_id: row.original.id })}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      );
    },
    meta: { className: "text-right w-full" },
  },
];


