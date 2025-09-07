import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@v1/supabase/types";

export async function getUserById(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, avatar_path, avatar_hue, brand_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateUser(
  supabase: SupabaseClient<Database>,
  id: string,
  input: Record<string, unknown>,
) {
  const { error } = await supabase.from("users").update(input).eq("id", id);
  if (error) throw error;
  return { success: true } as const;
}

export async function deleteUserAuth(
  supabaseAdmin: SupabaseClient<Database> | null,
  id: string,
) {
  if (!supabaseAdmin) {
    throw new Error("Service key not configured");
  }
  // Idempotent pre-check: if the user does not exist in GoTrue, treat as success
  const { data: getData, error: getErr } =
    await supabaseAdmin.auth.admin.getUserById(id);
  if (getErr) {
    // no-op: temporary diagnostics removed
  }
  const userFromAuth =
    typeof getData === "object" && getData !== null && "user" in getData
      ? (getData as { user: unknown }).user
      : undefined;
  if (!userFromAuth) return { success: true } as const;

  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (delErr) throw new Error(`Failed to delete user: ${delErr.message}`);
  return { success: true } as const;
}
