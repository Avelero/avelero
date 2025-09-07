import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@v1/supabase/types";
// invite-related utilities have been moved to queries/invites.ts

export async function listBrandsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("users_on_brand")
    .select(
      "role, brands:brands(id, name, logo_path, avatar_hue, country_code)",
    )
    .eq("user_id", userId)
    .order("brands(name)", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    role: string | null;
    brands: {
      id: string | null;
      name: string | null;
      logo_path: string | null;
      avatar_hue: number | null;
      country_code: string | null;
    } | null;
  }>;
  return rows.map((r) => ({
    id: r.brands?.id ?? null,
    name: r.brands?.name ?? null,
    logo_path: r.brands?.logo_path ?? null,
    avatar_hue: r.brands?.avatar_hue ?? null,
    country_code: r.brands?.country_code ?? null,
    role: r.role ?? null,
  }));
}

export async function createBrand(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: {
    name: string;
    country_code?: string | null;
    logo_path?: string | null;
    avatar_hue?: number | null;
  },
) {
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .insert({
      name: input.name,
      country_code: input.country_code ?? null,
      logo_path: input.logo_path ?? null,
      avatar_hue: input.avatar_hue ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (brandError) throw brandError;
  if (!brand) throw new Error("Failed to create brand");

  const { error: membershipError } = await supabase
    .from("users_on_brand")
    .insert({ user_id: userId, brand_id: brand.id, role: "owner" });
  if (membershipError) throw membershipError;

  const { error: userError } = await supabase
    .from("users")
    .update({ brand_id: brand.id })
    .eq("id", userId);
  if (userError) throw userError;

  return { id: brand.id } as const;
}

export async function updateBrand(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { id: string } & TablesUpdate<"brands">,
) {
  const { count, error: memErr } = await supabase
    .from("users_on_brand")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", input.id)
    .eq("user_id", userId);
  if (memErr) throw memErr;
  if (!count) throw new Error("FORBIDDEN");

  const { id, ...payload } = input;
  const { error } = await supabase
    .from("brands")
    .update(payload as TablesUpdate<"brands">)
    .eq("id", id);
  if (error) throw error;
  return { success: true } as const;
}

export async function deleteBrand(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) throw error;
  return { success: true } as const;
}

export async function setActiveBrand(
  supabase: SupabaseClient<Database>,
  userId: string,
  brandId: string,
) {
  const { count, error: countError } = await supabase
    .from("users_on_brand")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("brand_id", brandId);
  if (countError) throw countError;
  if (!count) throw new Error("Not a member of this brand");

  const { error } = await supabase
    .from("users")
    .update({ brand_id: brandId })
    .eq("id", userId);
  if (error) throw error;
  return { success: true } as const;
}

// ---------------------- Invites & Users helpers ----------------------

// (invite-related functions have been removed)

// ---------------------- Leave brand helpers ----------------------

export async function canLeaveBrand(
  supabase: SupabaseClient<Database>,
  userId: string,
  brandId: string,
) {
  // Fetch current membership role
  const { data: membership, error: membershipError } = await supabase
    .from("users_on_brand")
    .select("role")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
    .single();
  if (membershipError) throw membershipError;
  if (!membership) return { canLeave: false } as const;

  if ((membership.role as string) === "owner") {
    // Count owners for this brand
    const { count: ownerCount, error: countError } = await supabase
      .from("users_on_brand")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("role", "owner");
    if (countError) throw countError;
    if ((ownerCount ?? 0) <= 1) {
      return { canLeave: false, reason: "SOLE_OWNER" as const };
    }
  }

  return { canLeave: true } as const;
}

export async function leaveBrand(
  supabase: SupabaseClient<Database>,
  userId: string,
  brandId: string,
): Promise<
  { ok: true; nextBrandId: string | null } | { ok: false; code: "SOLE_OWNER" }
> {
  // Verify membership and role
  const { data: membership, error: membershipError } = await supabase
    .from("users_on_brand")
    .select("role")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
    .single();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error("Not a member of this brand");

  if ((membership.role as string) === "owner") {
    const { count: ownerCount, error: countError } = await supabase
      .from("users_on_brand")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("role", "owner");
    if (countError) throw countError;
    if ((ownerCount ?? 0) <= 1) {
      return { ok: false, code: "SOLE_OWNER" } as const;
    }
  }

  // Delete own membership row (RLS should allow self-delete)
  const { error: deleteError } = await supabase
    .from("users_on_brand")
    .delete()
    .eq("user_id", userId)
    .eq("brand_id", brandId);
  if (deleteError) throw deleteError;

  // Determine resulting active brand id
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("brand_id")
    .eq("id", userId)
    .single();
  if (userError) throw userError;

  let resultingActiveBrandId: string | null = userRow?.brand_id ?? null;

  if (userRow?.brand_id === brandId) {
    // Need to set a new active brand (first by alphabetical name), or null
    const { data: next, error: nextError } = await supabase
      .from("users_on_brand")
      .select("brand_id, brands:brands(name)")
      .eq("user_id", userId)
      .order("brands(name)", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextError) throw nextError;

    const nextRow = next as { brand_id: string | null } | null;
    resultingActiveBrandId = nextRow?.brand_id ?? null;

    const { error: updateUserError } = await supabase
      .from("users")
      .update({ brand_id: resultingActiveBrandId })
      .eq("id", userId);
    if (updateUserError) throw updateUserError;
  }

  return { ok: true, nextBrandId: resultingActiveBrandId } as const;
}
