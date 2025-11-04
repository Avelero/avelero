import { MembersTable } from "@/components/tables/members/members";
import { MembersSkeleton } from "@/components/tables/members/skeleton";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { createClient as createSupabaseServerClient } from "@v1/supabase/server";
import { Suspense } from "react";

export default async function Page() {
  const queryClient = getQueryClient();

  // Prefetch composite members + invites when active brand is available
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const { data } = await supabase
        .from("users")
        .select("brand_id")
        .eq("id", user.id)
        .single();
      const brandId =
        (data as { brand_id: string | null } | null)?.brand_id ?? null;
      if (brandId) {
        await queryClient.prefetchQuery(
          trpc.composite.membersWithInvites.queryOptions({
            brand_id: brandId,
          }),
        );
      }
    }
  } catch {}

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <Suspense fallback={<MembersSkeleton />}>
          <MembersTable />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
