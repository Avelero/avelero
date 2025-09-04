import { logger } from "@v1/logger";
import { createClient } from "@v1/supabase/server";
import type { Tables } from "../types";

export async function getUser() {
  const supabase = await createClient();

  try {
    const result = await supabase.auth.getUser();

    return result;
  } catch (error) {
    logger.error(error);

    throw error;
  }
}

export async function getPosts() {
  // posts feature removed
  return { data: [] as Array<never>, error: null };
}

export async function getUserProfile() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, avatar_path, brand_id")
      .single();
    return { data: data as Tables<"users"> | null, error };
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export async function getMyBrands() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, logo_path, country_code")
      .order("name", { ascending: true });
    return {
      data: data as Array<Pick<Tables<"brands">, "id" | "name">>,
      error,
    };
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
