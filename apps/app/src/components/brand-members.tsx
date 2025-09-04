import { MembersTable } from "@/components/tables/members/members";
// Legacy skeleton import removed; using unified members table, keep fallback minimal
import { Skeleton } from "@v1/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { Suspense } from "react";

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
        <Suspense
          fallback={
            <div className="p-4 space-y-2">
              {["a", "b", "c"].map((k) => (
                <div
                  key={`team-members-skel-${k}`}
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
          }
        >
          <MembersTable />
        </Suspense>
      </TabsContent>

      <TabsContent value="pending">
        <Suspense
          fallback={
            <div className="p-4 space-y-2">
              {["a", "b", "c"].map((k) => (
                <div
                  key={`pending-invites-skel-${k}`}
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
          }
        >
          <MembersTable />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
