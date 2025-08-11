import { logger } from "@v1/logger";
import { createClient } from "@v1/supabase/server";
import type { TablesUpdate } from "../types";

export async function updateUser(userId: string, data: TablesUpdate<"users">) {
  const supabase = createClient();

  try {
    const result = await supabase.from("users").update(data).eq("id", userId);

    return result;
  } catch (error) {
    logger.error(error);

    throw error;
  }
}

export async function createBrand(params: { name: string; country_code?: string | null; logo_url?: string | null; ownerId: string }) {
  const supabase = createClient();

  try {
    // 1) create the brand (created_by must be ownerId; types model may omit it, so pass via insert)
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .insert({
        name: params.name,
        country_code: params.country_code ?? null,
        logo_url: params.logo_url ?? null,
        created_by: params.ownerId,
      })
      .select("id")
      .single();

    if (brandError) return { error: brandError };
    if (!brand) return { error: { message: "Failed to create brand" } } as const;

    // 2) add owner membership
    const { error: membershipError } = await supabase
      .from("users_on_brand")
      .insert({ user_id: params.ownerId, brand_id: brand.id, role: "owner" });
    if (membershipError) return { error: membershipError };

    // 3) set active brand on user
    const { error: userError } = await supabase
      .from("users")
      .update({ brand_id: brand.id })
      .eq("id", params.ownerId);
    if (userError) return { error: userError };

    return { data: { brandId: brand.id } } as const;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export async function setActiveBrand(userId: string, brandId: string) {
  const supabase = createClient();

  try {
    // Guard: ensure membership exists (RLS protects too, but helpful error)
    const { count, error: countError } = await supabase
      .from("users_on_brand")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("brand_id", brandId);
    if (countError) return { error: countError };
    if (!count) return { error: { message: "Not a member of this brand" } } as const;

    const { error } = await supabase.from("users").update({ brand_id: brandId }).eq("id", userId);
    if (error) return { error };

    return { data: { brandId } } as const;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
