import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { MemberInvitesTable } from "@/components/tables/member-invites";
import { PendingInvitesSkeleton } from "@/components/tables/member-invites/skeleton";
import { DataTable as MembersTable } from "@/components/tables/members";

export function TeamMembers({ brandId }: { brandId: string }) {
  return (
    <Tabs defaultValue="members">
      <TabsList className="bg-transparent border-b-[1px] w-full justify-start rounded-none mb-1 p-0 h-auto pb-4">
        <TabsTrigger value="members" className="p-0 m-0 mr-4">
          Team Members
        </TabsTrigger>
        <TabsTrigger value="pending" className="p-0 m-0">
          Pending Invitations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="members">
        <Suspense fallback={<PendingInvitesSkeleton brandId={brandId} />}>
          <MembersTable />
        </Suspense>
      </TabsContent>

      <TabsContent value="pending">
        <Suspense fallback={<PendingInvitesSkeleton brandId={brandId} />}>
          <MemberInvitesTable brandId={brandId} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}


