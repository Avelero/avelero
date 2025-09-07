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
    .select(
      "user_id, role, created_at, users:users(id, email, full_name, avatar_path, avatar_hue)",
    )
    .eq("brand_id", brandId);
  if (error) throw error;
  type MemberRow = {
    user_id: string | null;
    role: string | null;
    created_at: string | null;
    users: {
      id: string | null;
      email: string | null;
      full_name: string | null;
      avatar_path: string | null;
      avatar_hue: number | null;
    } | null;
  };
  const rows = (data ?? []) as MemberRow[];
  return rows.map((row) => ({
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

export async function updateMemberRole(
  supabase: SupabaseClient<Database>,
  actingUserId: string,
  brandId: string,
  userId: string,
  role: "owner" | "member",
) {
  // Ensure acting user is owner
  await assertOwner(supabase, actingUserId, brandId);
  const { error } = await supabase
    .from("users_on_brand")
    .update({ role })
    .eq("brand_id", brandId)
    .eq("user_id", userId);
  if (error) throw error;
  return { success: true } as const;
}

export async function deleteMember(
  supabase: SupabaseClient<Database>,
  actingUserId: string,
  brandId: string,
  userId: string,
) {
  // Ensure acting user is owner and prevent removing last owner
  await assertOwner(supabase, actingUserId, brandId);
  // Check target role
  const { data: target, error: readErr } = await supabase
    .from("users_on_brand")
    .select("role")
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .single();
  if (readErr) throw readErr;
  if ((target?.role as string) === "owner") {
    const { count, error: countErr } = await supabase
      .from("users_on_brand")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("role", "owner");
    if (countErr) throw countErr;
    if ((count ?? 0) <= 1) throw new Error("SOLE_OWNER");
  }
  const { error } = await supabase
    .from("users_on_brand")
    .delete()
    .eq("brand_id", brandId)
    .eq("user_id", userId);
  if (error) throw error;
  return { success: true } as const;
}
