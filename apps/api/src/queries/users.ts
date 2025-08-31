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
  if (!supabaseAdmin) throw new Error("Service key not configured");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) throw error;
  return { success: true } as const;
}


