import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { MembersTable } from "@/components/tables/members/members";
import { createClient as createSupabaseServerClient } from "@v1/supabase/server";

export default async function Page() {
  // Prefetch members and invites for better UX using server-side brand context
  batchPrefetch([trpc.brand.members.queryOptions()]);

  // Also prefetch invites if we can resolve the active brand_id server-side
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const { data } = await supabase.from("users").select("brand_id").eq("id", user.id).single();
      const brandId = (data as any)?.brand_id as string | null;
      if (brandId) {
        batchPrefetch([trpc.brand.listInvites.queryOptions({ brand_id: brandId }) as any]);
      }
    }
  } catch {}

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <MembersTable />
      </div>
    </HydrateClient>
  );
}


