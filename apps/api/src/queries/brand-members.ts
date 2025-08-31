import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@v1/supabase/types";

export async function assertOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  brandId: string,
) {
  const { count, error } = await supabase
    .from("users_on_brand")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .eq("role", "owner");
  if (error) throw error;
  if (!count) throw new Error("FORBIDDEN");
}

export async function getMembersByBrandId(
  supabase: SupabaseClient<Database>,
  brandId: string,
) {
  const { data, error } = await supabase
    .from("users_on_brand")
    .select("user_id, role, created_at, users:users(id, email, full_name, avatar_path, avatar_hue)")
    .eq("brand_id", brandId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.user_id as string,
    role: (row.role as string) ?? null,
    teamId: brandId,
    created_at: row.created_at ?? null,
    user: {
      id: row.users?.id ?? null,
      email: row.users?.email ?? null,
      fullName: row.users?.full_name ?? null,
      avatarUrl: row.users?.avatar_path ?? null,
      avatarHue: row.users?.avatar_hue ?? null,
    },
  }));
}


