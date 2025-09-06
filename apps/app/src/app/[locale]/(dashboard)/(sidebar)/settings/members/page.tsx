import { MembersTable } from "@/components/tables/members/members";
import { MembersSkeleton } from "@/components/tables/members/skeleton";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { createClient as createSupabaseServerClient } from "@v1/supabase/server";
import { Suspense } from "react";

export default async function Page() {
  // Prefetch members and invites for better UX using server-side brand context
  await batchPrefetch([trpc.brand.members.queryOptions()]);

  // Also prefetch invites if we can resolve the active brand_id server-side
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
        const invitesOpts = trpc.brand.listInvites.queryOptions({
          brand_id: brandId,
        });
        await batchPrefetch([invitesOpts]);
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
