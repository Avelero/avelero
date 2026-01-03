

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "drizzle";


ALTER SCHEMA "drizzle" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."user_role" AS ENUM (
    'owner',
    'member'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite_from_cookie"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  v_now         timestamptz := now();
  v_token_hash  text;
  v_email       text;
  v_brand       uuid;
  v_role        text;
begin
  -- Normalize token: if looks like hex hash, use it; otherwise hash raw token to hex
  if p_token ~ '^[0-9A-Fa-f]{64}$' then
    v_token_hash := lower(p_token);
  else
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  end if;

  -- Fetch a valid invite for this token
  select bi.email, bi.brand_id, bi.role
    into v_email, v_brand, v_role
  from public.brand_invites bi
  where bi.token_hash = v_token_hash
    and (bi.expires_at is null or bi.expires_at > v_now)
  limit 1;

  if not found then
    raise exception 'Invite not found or expired';
  end if;

  -- Bind to caller identity (JWT email)
  if lower(trim(v_email)) <> lower(trim(coalesce(auth.email(), auth.jwt() ->> 'email'))) then
    raise exception 'Invite does not belong to the current user';
  end if;

  -- Create or elevate membership
  insert into public.brand_members(user_id, brand_id, role)
  values (auth.uid(), v_brand, v_role)
  on conflict (user_id, brand_id) do update
  set role = excluded.role;

  -- Set active brand
  update public.users
    set brand_id = v_brand
  where id = auth.uid();

  -- Delete the invite on resolution
  delete from public.brand_invites
  where token_hash = v_token_hash
    and brand_id = v_brand
    and lower(trim(email)) = lower(trim(v_email));
end;
$_$;


ALTER FUNCTION "public"."accept_invite_from_cookie"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."batch_insert_staging_with_status"("p_products" "jsonb", "p_variants" "jsonb", "p_status_updates" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_product_ids uuid[];
  v_variant_ids uuid[];
  v_result jsonb;
  v_rows_updated integer;
BEGIN
  -- Insert products and collect staging IDs
  WITH inserted_products AS (
    INSERT INTO staging_products (
      job_id, row_number, action, existing_product_id,
      id, brand_id, product_identifier, product_upid,
      name, description, showcase_brand_id, primary_image_url,
      additional_image_urls, category_id, season, season_id,
      tags, brand_certification_id, status
    )
    SELECT
      (value->>'jobId')::uuid,
      (value->>'rowNumber')::int,
      (value->>'action')::text,
      (value->>'existingProductId')::uuid,
      (value->>'id')::uuid,
      (value->>'brandId')::uuid,
      value->>'productIdentifier',
      value->>'productUpid',
      value->>'name',
      value->>'description',
      (value->>'showcaseBrandId')::uuid,
      value->>'primaryImageUrl',
      value->>'additionalImageUrls',
      (value->>'categoryId')::uuid,
      value->>'season',
      (value->>'seasonId')::uuid,
      value->>'tags',
      (value->>'brandCertificationId')::uuid,
      value->>'status'
    FROM jsonb_array_elements(p_products)
    RETURNING staging_id
  )
  SELECT array_agg(staging_id ORDER BY staging_id) INTO v_product_ids FROM inserted_products;

  -- Insert variants using corresponding product IDs by index
  WITH indexed_variants AS (
    SELECT
      value,
      row_number() OVER () as idx
    FROM jsonb_array_elements(p_variants)
  ),
  inserted_variants AS (
    INSERT INTO staging_product_variants (
      staging_product_id, job_id, row_number, action,
      existing_variant_id, id, product_id, color_id, size_id,
      sku, ean, upid, product_image_url, status
    )
    SELECT
      v_product_ids[idx],
      (value->>'jobId')::uuid,
      (value->>'rowNumber')::int,
      (value->>'action')::text,
      (value->>'existingVariantId')::uuid,
      (value->>'id')::uuid,
      (value->>'productId')::uuid,
      (value->>'colorId')::uuid,
      (value->>'sizeId')::uuid,
      value->>'sku',
      value->>'ean',
      value->>'upid',
      value->>'productImageUrl',
      value->>'status'
    FROM indexed_variants
    RETURNING staging_id
  )
  SELECT array_agg(staging_id ORDER BY staging_id) INTO v_variant_ids FROM inserted_variants;

  -- Update import_rows status in bulk
  WITH status_updates AS (
    SELECT
      (value->>'id')::uuid as row_id,
      (value->>'status')::text as new_status,
      (value->'normalized')::jsonb as normalized_data,
      value->>'error' as error_msg
    FROM jsonb_array_elements(p_status_updates)
  )
  UPDATE import_rows
  SET
    status = status_updates.new_status,
    normalized = status_updates.normalized_data,
    error = status_updates.error_msg,
    updated_at = now()
  FROM status_updates
  WHERE import_rows.id = status_updates.row_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- Return summary
  SELECT jsonb_build_object(
    'products_inserted', coalesce(array_length(v_product_ids, 1), 0),
    'variants_inserted', coalesce(array_length(v_variant_ids, 1), 0),
    'rows_updated', v_rows_updated,
    'product_ids', CASE WHEN v_product_ids IS NOT NULL THEN to_jsonb(v_product_ids) ELSE '[]'::jsonb END,
    'variant_ids', CASE WHEN v_variant_ids IS NOT NULL THEN to_jsonb(v_variant_ids) ELSE '[]'::jsonb END
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."batch_insert_staging_with_status"("p_products" "jsonb", "p_variants" "jsonb", "p_status_updates" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."batch_insert_staging_with_status"("p_products" "jsonb", "p_variants" "jsonb", "p_status_updates" "jsonb") IS 'Batch inserts staging products, variants, and updates import row statuses in a single database round trip.
   Used for performance optimization during bulk product imports to reduce network latency overhead.

   Parameters:
   - p_products: Array of staging product objects
   - p_variants: Array of staging variant objects (order must match products)
   - p_status_updates: Array of import row status updates

   Returns: JSON object with counts and IDs of inserted records';



CREATE OR REPLACE FUNCTION "public"."claim_invites_for_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text;
begin
  select email into v_email from public.users where id = p_user_id;
  
  if v_email is null then
    return;
  end if;

  with eligible as (
    select bi.id, bi.brand_id, bi.role
    from public.brand_invites bi
    where lower(bi.email) = lower(v_email)
      and bi.status = 'accepted'
      and (bi.expires_at is null or bi.expires_at > now())
  ), 
  inserted as (
    insert into public.brand_members (user_id, brand_id, role)
    select p_user_id, e.brand_id, e.role 
    from eligible e
    on conflict (user_id, brand_id) do update 
      set role = excluded.role
    returning brand_members.brand_id
  )
  update public.brand_invites bi
  set status = 'fulfilled', fulfilled_at = now()
  from eligible e
  where bi.id = e.id 
    and bi.status <> 'fulfilled';
end;
$$;


ALTER FUNCTION "public"."claim_invites_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brands_for_authenticated_user"() RETURNS TABLE("member_brand_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select bm.brand_id as member_brand_id
  from public.brand_members bm
  where bm.user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_brands_for_authenticated_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_brand_id"("product_id_param" "uuid") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT brand_id FROM public.products WHERE id = product_id_param;
$$;


ALTER FUNCTION "public"."get_product_brand_id"("product_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_product_brand_id"("product_id_param" "uuid") IS 'Helper function to resolve brand_id from product_id for unique constraints on product_variants.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_brand_member"("b_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.brand_members bm
    where bm.brand_id = b_id and bm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_brand_member"("b_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_brand_owner"("b_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.brand_members bm
    where bm.brand_id = b_id and bm.user_id = auth.uid() and bm.role = 'owner'
  );
$$;


ALTER FUNCTION "public"."is_brand_owner"("b_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shares_brand_with"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.brand_members u1
    join public.brand_members u2 on u1.brand_id = u2.brand_id
    where u1.user_id = p_user_id
      and u2.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."shares_brand_with"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    "id" integer NOT NULL,
    "hash" "text" NOT NULL,
    "created_at" bigint
);


ALTER TABLE "drizzle"."__drizzle_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "drizzle"."__drizzle_migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNED BY "drizzle"."__drizzle_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."brand_attribute_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "attribute_id" "uuid" NOT NULL,
    "taxonomy_value_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_attribute_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_attributes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "taxonomy_attribute_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "certification_code" "text",
    "institute_name" "text",
    "institute_email" "text",
    "issue_date" timestamp without time zone,
    "expiry_date" timestamp without time zone,
    "file_path" "uuid",
    "institute_website" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "institute_address_line_1" "text",
    "institute_address_line_2" "text",
    "institute_city" "text",
    "institute_state" "text",
    "institute_zip" "text",
    "institute_country_code" "text"
);


ALTER TABLE "public"."brand_certifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "filter" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_eco_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "claim" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_eco_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_facilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "legal_name" "text",
    "city" "text",
    "country_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "phone" "text",
    "website" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "state" "text",
    "zip" "text"
);


ALTER TABLE "public"."brand_facilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "credentials" "text",
    "credentials_iv" "text",
    "shop_domain" "text",
    "sync_interval" integer DEFAULT 86400 NOT NULL,
    "last_sync_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token_hash" "text",
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "brand_invites_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."brand_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_manufacturers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "legal_name" "text",
    "email" "text",
    "phone" "text",
    "website" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "country_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_manufacturers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "certification_id" "uuid",
    "recyclable" boolean,
    "country_of_origin" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "brand_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."brand_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "ongoing" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hex" "text"
);


ALTER TABLE "public"."brand_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_theme" (
    "brand_id" "uuid" NOT NULL,
    "theme_styles" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "theme_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stylesheet_path" "text",
    "google_fonts_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "screenshot_desktop_path" "text",
    "screenshot_mobile_path" "text"
);


ALTER TABLE "public"."brand_theme" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "country_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_hue" smallint,
    "logo_path" "text",
    "email" "text",
    "slug" "text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "brands_avatar_hue_check" CHECK ((("avatar_hue" IS NULL) OR (("avatar_hue" >= 1) AND ("avatar_hue" <= 360))))
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid",
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "mime_type" "text",
    "bytes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."file_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "summary" "jsonb",
    "commit_started_at" timestamp with time zone,
    "requires_value_approval" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "raw" "jsonb" NOT NULL,
    "normalized" "jsonb",
    "error" "text",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_certification_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "certification_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_name" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_certification_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_eco_claim_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "eco_claim_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_name" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_eco_claim_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_facility_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_name" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_facility_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_field_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "field_key" "text" NOT NULL,
    "ownership_enabled" boolean DEFAULT true NOT NULL,
    "source_option_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_field_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_manufacturer_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "manufacturer_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_name" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_manufacturer_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_material_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_name" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_material_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_product_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_name" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_synced_hash" "text"
);


ALTER TABLE "public"."integration_product_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_season_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_name" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_season_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "trigger_type" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "products_processed" integer DEFAULT 0 NOT NULL,
    "products_created" integer DEFAULT 0 NOT NULL,
    "products_updated" integer DEFAULT 0 NOT NULL,
    "products_failed" integer DEFAULT 0 NOT NULL,
    "products_skipped" integer DEFAULT 0 NOT NULL,
    "entities_created" integer DEFAULT 0 NOT NULL,
    "error_summary" "text",
    "error_log" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "variants_processed" integer DEFAULT 0 NOT NULL,
    "variants_created" integer DEFAULT 0 NOT NULL,
    "variants_updated" integer DEFAULT 0 NOT NULL,
    "variants_failed" integer DEFAULT 0 NOT NULL,
    "variants_skipped" integer DEFAULT 0 NOT NULL,
    "products_total" integer
);


ALTER TABLE "public"."integration_sync_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_tag_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_name" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_tag_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_variant_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_integration_id" "uuid" NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_product_id" "text",
    "external_sku" "text",
    "external_barcode" "text",
    "last_synced_at" timestamp with time zone,
    "last_synced_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_variant_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "auth_type" "text" NOT NULL,
    "icon_path" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state" "text" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "integration_slug" "text" NOT NULL,
    "shop_domain" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oauth_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_commercial" (
    "product_id" "uuid" NOT NULL,
    "webshop_url" "text",
    "price" numeric(10,2),
    "currency" "text",
    "sales_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_commercial" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_eco_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "eco_claim_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_eco_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_environment" (
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "value" numeric(12,4),
    "unit" "text",
    "metric" "text" NOT NULL
);


ALTER TABLE "public"."product_environment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_journey_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "sort_index" integer NOT NULL,
    "step_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "facility_id" "uuid" NOT NULL
);


ALTER TABLE "public"."product_journey_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "brand_material_id" "uuid" NOT NULL,
    "percentage" numeric(6,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_variant_attributes" (
    "variant_id" "uuid" NOT NULL,
    "attribute_value_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_variant_attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "upid" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "barcode" "text",
    "sku" "text",
    "name" "text",
    "description" "text",
    "image_path" "text",
    "source_integration" "text",
    "source_external_id" "text"
);


ALTER TABLE "public"."product_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_weight" (
    "product_id" "uuid" NOT NULL,
    "weight" numeric(10,2),
    "weight_unit" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_weight" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "manufacturer_id" "uuid",
    "image_path" "text",
    "category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "season_id" "uuid",
    "product_handle" "text" NOT NULL,
    "status" "text" DEFAULT 'unpublished'::"text" NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_product_eco_claims" (
    "staging_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staging_product_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "eco_claim_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staging_product_eco_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_product_environment" (
    "staging_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staging_product_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "carbon_kg_co2e" numeric(12,4),
    "water_liters" numeric(12,4),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staging_product_environment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_product_journey_steps" (
    "staging_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staging_product_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "sort_index" integer NOT NULL,
    "step_type" "text" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staging_product_journey_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_product_materials" (
    "staging_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staging_product_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "brand_material_id" "uuid" NOT NULL,
    "percentage" numeric(6,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staging_product_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_product_tags" (
    "staging_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staging_product_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staging_product_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_product_variants" (
    "staging_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staging_product_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "action" "text" NOT NULL,
    "existing_variant_id" "uuid",
    "id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "color_id" "uuid",
    "size_id" "uuid",
    "upid" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staging_product_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_products" (
    "staging_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "action" "text" NOT NULL,
    "existing_product_id" "uuid",
    "id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "manufacturer_id" "uuid",
    "image_path" "text",
    "category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "season_id" "uuid",
    "product_handle" "text",
    "product_upid" "text",
    "status" "text"
);


ALTER TABLE "public"."staging_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy_attributes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "friendly_id" "text" NOT NULL,
    "public_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."taxonomy_attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "public_id" "text" NOT NULL
);


ALTER TABLE "public"."taxonomy_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy_external_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "source_system" "text" NOT NULL,
    "source_taxonomy" "text" NOT NULL,
    "target_taxonomy" "text" NOT NULL,
    "version" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."taxonomy_external_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attribute_id" "uuid" NOT NULL,
    "friendly_id" "text" NOT NULL,
    "public_id" "text" NOT NULL,
    "public_attribute_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."taxonomy_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "brand_id" "uuid",
    "avatar_hue" smallint,
    "avatar_path" "text",
    CONSTRAINT "users_avatar_hue_check" CHECK ((("avatar_hue" IS NULL) OR (("avatar_hue" >= 1) AND ("avatar_hue" <= 360))))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."value_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "source_column" "text" NOT NULL,
    "raw_value" "text" NOT NULL,
    "target" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."value_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_commercial" (
    "variant_id" "uuid" NOT NULL,
    "webshop_url" "text",
    "price" numeric(10,2),
    "currency" "text",
    "sales_status" "text",
    "source_integration" "text",
    "source_external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."variant_commercial" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_eco_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "eco_claim_id" "uuid" NOT NULL,
    "source_integration" "text",
    "source_external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."variant_eco_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_environment" (
    "variant_id" "uuid" NOT NULL,
    "carbon_kg_co2e" numeric(12,4),
    "water_liters" numeric(12,2),
    "source_integration" "text",
    "source_external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."variant_environment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_journey_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "sort_index" integer NOT NULL,
    "step_type" "text" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "source_integration" "text",
    "source_external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."variant_journey_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "brand_material_id" "uuid" NOT NULL,
    "percentage" numeric(6,2),
    "source_integration" "text",
    "source_external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."variant_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_weight" (
    "variant_id" "uuid" NOT NULL,
    "weight" numeric(10,2),
    "weight_unit" "text",
    "source_integration" "text",
    "source_external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."variant_weight" OWNER TO "postgres";


ALTER TABLE ONLY "drizzle"."__drizzle_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"drizzle"."__drizzle_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "drizzle"."__drizzle_migrations"
    ADD CONSTRAINT "__drizzle_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_attribute_values"
    ADD CONSTRAINT "brand_attribute_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_attributes"
    ADD CONSTRAINT "brand_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_certifications"
    ADD CONSTRAINT "brand_certifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_collections"
    ADD CONSTRAINT "brand_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_eco_claims"
    ADD CONSTRAINT "brand_eco_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_facilities"
    ADD CONSTRAINT "brand_facilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_integrations"
    ADD CONSTRAINT "brand_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_invites"
    ADD CONSTRAINT "brand_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_materials"
    ADD CONSTRAINT "brand_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_seasons"
    ADD CONSTRAINT "brand_seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_tags"
    ADD CONSTRAINT "brand_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_theme"
    ADD CONSTRAINT "brand_theme_brand_id_pkey" PRIMARY KEY ("brand_id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy_categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_assets"
    ADD CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_rows"
    ADD CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_certification_links"
    ADD CONSTRAINT "integration_certification_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_eco_claim_links"
    ADD CONSTRAINT "integration_eco_claim_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_facility_links"
    ADD CONSTRAINT "integration_facility_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_field_configs"
    ADD CONSTRAINT "integration_field_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_manufacturer_links"
    ADD CONSTRAINT "integration_manufacturer_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_material_links"
    ADD CONSTRAINT "integration_material_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_product_links"
    ADD CONSTRAINT "integration_product_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_season_links"
    ADD CONSTRAINT "integration_season_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_sync_jobs"
    ADD CONSTRAINT "integration_sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_tag_links"
    ADD CONSTRAINT "integration_tag_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_variant_links"
    ADD CONSTRAINT "integration_variant_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_commercial"
    ADD CONSTRAINT "product_commercial_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_eco_claims"
    ADD CONSTRAINT "product_eco_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_environment"
    ADD CONSTRAINT "product_environment_pkey" PRIMARY KEY ("product_id", "metric");



ALTER TABLE ONLY "public"."product_journey_steps"
    ADD CONSTRAINT "product_journey_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_materials"
    ADD CONSTRAINT "product_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_variant_attributes"
    ADD CONSTRAINT "product_variant_attributes_pkey" PRIMARY KEY ("variant_id", "attribute_value_id");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_weight"
    ADD CONSTRAINT "product_weight_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_manufacturers"
    ADD CONSTRAINT "showcase_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_product_eco_claims"
    ADD CONSTRAINT "staging_product_eco_claims_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."staging_product_environment"
    ADD CONSTRAINT "staging_product_environment_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."staging_product_journey_steps"
    ADD CONSTRAINT "staging_product_journey_steps_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."staging_product_materials"
    ADD CONSTRAINT "staging_product_materials_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."staging_product_tags"
    ADD CONSTRAINT "staging_product_tags_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."staging_product_variants"
    ADD CONSTRAINT "staging_product_variants_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."staging_products"
    ADD CONSTRAINT "staging_products_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."product_tags"
    ADD CONSTRAINT "tags_on_product_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy_attributes"
    ADD CONSTRAINT "taxonomy_attributes_friendly_id_unique" UNIQUE ("friendly_id");



ALTER TABLE ONLY "public"."taxonomy_attributes"
    ADD CONSTRAINT "taxonomy_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy_attributes"
    ADD CONSTRAINT "taxonomy_attributes_public_id_unique" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."taxonomy_categories"
    ADD CONSTRAINT "taxonomy_categories_public_id_unique" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."taxonomy_external_mappings"
    ADD CONSTRAINT "taxonomy_external_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy_values"
    ADD CONSTRAINT "taxonomy_values_friendly_id_unique" UNIQUE ("friendly_id");



ALTER TABLE ONLY "public"."taxonomy_values"
    ADD CONSTRAINT "taxonomy_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy_values"
    ADD CONSTRAINT "taxonomy_values_public_id_unique" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."brand_members"
    ADD CONSTRAINT "brand_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_members"
    ADD CONSTRAINT "brand_members_user_id_brand_id_key" UNIQUE ("user_id", "brand_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."value_mappings"
    ADD CONSTRAINT "value_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."variant_commercial"
    ADD CONSTRAINT "variant_commercial_pkey" PRIMARY KEY ("variant_id");



ALTER TABLE ONLY "public"."variant_eco_claims"
    ADD CONSTRAINT "variant_eco_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."variant_environment"
    ADD CONSTRAINT "variant_environment_pkey" PRIMARY KEY ("variant_id");



ALTER TABLE ONLY "public"."variant_journey_steps"
    ADD CONSTRAINT "variant_journey_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."variant_materials"
    ADD CONSTRAINT "variant_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."variant_weight"
    ADD CONSTRAINT "variant_weight_pkey" PRIMARY KEY ("variant_id");



CREATE UNIQUE INDEX "brand_attribute_values_brand_attr_name_unq" ON "public"."brand_attribute_values" USING "btree" ("brand_id", "attribute_id", "name");



CREATE UNIQUE INDEX "brand_attributes_brand_name_unq" ON "public"."brand_attributes" USING "btree" ("brand_id", "name");



CREATE UNIQUE INDEX "brand_collections_brand_name_unq" ON "public"."brand_collections" USING "btree" ("brand_id", "name");



CREATE UNIQUE INDEX "brand_eco_claims_brand_claim_unq" ON "public"."brand_eco_claims" USING "btree" ("brand_id", "claim");



CREATE UNIQUE INDEX "brand_integrations_brand_integration_unq" ON "public"."brand_integrations" USING "btree" ("brand_id", "integration_id");



CREATE UNIQUE INDEX "brand_manufacturers_brand_name_unq" ON "public"."brand_manufacturers" USING "btree" ("brand_id", "name");



CREATE UNIQUE INDEX "brand_seasons_brand_name_unq" ON "public"."brand_seasons" USING "btree" ("brand_id", "name");



CREATE UNIQUE INDEX "brand_tags_brand_name_unq" ON "public"."brand_tags" USING "btree" ("brand_id", "name");



CREATE INDEX "categories_parent_id_idx" ON "public"."taxonomy_categories" USING "btree" ("parent_id");



CREATE UNIQUE INDEX "categories_parent_name_unq" ON "public"."taxonomy_categories" USING "btree" ("parent_id", "name");



CREATE UNIQUE INDEX "file_assets_bucket_path_unq" ON "public"."file_assets" USING "btree" ("bucket", "path");



CREATE INDEX "idx_brand_integrations_brand_id" ON "public"."brand_integrations" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_integrations_status" ON "public"."brand_integrations" USING "btree" ("status");



CREATE INDEX "idx_brand_invites_brand_id" ON "public"."brand_invites" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_invites_email" ON "public"."brand_invites" USING "btree" ("email");



CREATE INDEX "idx_brand_invites_email_expires" ON "public"."brand_invites" USING "btree" ("email", "expires_at");



CREATE INDEX "idx_brand_invites_expires_at" ON "public"."brand_invites" USING "btree" ("expires_at");



CREATE INDEX "idx_brand_invites_token_hash" ON "public"."brand_invites" USING "btree" ("token_hash");



CREATE INDEX "idx_brand_invites_valid_lookup" ON "public"."brand_invites" USING "btree" ("brand_id", "expires_at");



CREATE INDEX "idx_brand_theme_updated_at" ON "public"."brand_theme" USING "btree" ("updated_at");



CREATE INDEX "idx_brands_active" ON "public"."brands" USING "btree" ("id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_brands_avatar_hue" ON "public"."brands" USING "btree" ("avatar_hue") WHERE ("avatar_hue" IS NOT NULL);



CREATE INDEX "idx_brands_email" ON "public"."brands" USING "btree" ("email");



CREATE UNIQUE INDEX "idx_brands_slug" ON "public"."brands" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_integration_certification_links_cert" ON "public"."integration_certification_links" USING "btree" ("certification_id");



CREATE INDEX "idx_integration_eco_claim_links_claim" ON "public"."integration_eco_claim_links" USING "btree" ("eco_claim_id");



CREATE INDEX "idx_integration_facility_links_facility" ON "public"."integration_facility_links" USING "btree" ("facility_id");



CREATE INDEX "idx_integration_field_configs_integration" ON "public"."integration_field_configs" USING "btree" ("brand_integration_id");



CREATE INDEX "idx_integration_manufacturer_links_mfr" ON "public"."integration_manufacturer_links" USING "btree" ("manufacturer_id");



CREATE INDEX "idx_integration_material_links_material" ON "public"."integration_material_links" USING "btree" ("material_id");



CREATE INDEX "idx_integration_product_links_product" ON "public"."integration_product_links" USING "btree" ("product_id");



CREATE INDEX "idx_integration_season_links_season" ON "public"."integration_season_links" USING "btree" ("season_id");



CREATE INDEX "idx_integration_sync_jobs_created" ON "public"."integration_sync_jobs" USING "btree" ("created_at");



CREATE INDEX "idx_integration_sync_jobs_integration" ON "public"."integration_sync_jobs" USING "btree" ("brand_integration_id");



CREATE INDEX "idx_integration_sync_jobs_status" ON "public"."integration_sync_jobs" USING "btree" ("status");



CREATE INDEX "idx_integration_tag_links_tag" ON "public"."integration_tag_links" USING "btree" ("tag_id");



CREATE INDEX "idx_integration_variant_links_integration" ON "public"."integration_variant_links" USING "btree" ("brand_integration_id");



CREATE INDEX "idx_integration_variant_links_variant" ON "public"."integration_variant_links" USING "btree" ("variant_id");



CREATE INDEX "idx_oauth_states_expires" ON "public"."oauth_states" USING "btree" ("expires_at");



CREATE INDEX "idx_oauth_states_state" ON "public"."oauth_states" USING "btree" ("state");



CREATE INDEX "idx_product_eco_claims_product_created" ON "public"."product_eco_claims" USING "btree" ("product_id", "created_at");



CREATE INDEX "idx_product_eco_claims_product_id" ON "public"."product_eco_claims" USING "btree" ("product_id");



CREATE INDEX "idx_product_journey_steps_product_id" ON "public"."product_journey_steps" USING "btree" ("product_id");



CREATE INDEX "idx_product_journey_steps_product_sort" ON "public"."product_journey_steps" USING "btree" ("product_id", "sort_index");



CREATE INDEX "idx_product_materials_product_created" ON "public"."product_materials" USING "btree" ("product_id", "created_at");



CREATE INDEX "idx_product_materials_product_id" ON "public"."product_materials" USING "btree" ("product_id");



CREATE INDEX "idx_product_variant_attributes_variant" ON "public"."product_variant_attributes" USING "btree" ("variant_id");



CREATE INDEX "idx_product_variants_product_created" ON "public"."product_variants" USING "btree" ("product_id", "created_at");



CREATE INDEX "idx_product_variants_product_id" ON "public"."product_variants" USING "btree" ("product_id");



CREATE INDEX "idx_product_variants_upid" ON "public"."product_variants" USING "btree" ("upid") WHERE ("upid" IS NOT NULL);



CREATE INDEX "idx_products_brand_category" ON "public"."products" USING "btree" ("brand_id", "category_id");



CREATE INDEX "idx_products_brand_created" ON "public"."products" USING "btree" ("brand_id", "created_at");



CREATE INDEX "idx_products_brand_id" ON "public"."products" USING "btree" ("brand_id");



CREATE INDEX "idx_products_brand_name" ON "public"."products" USING "btree" ("brand_id", "name");



CREATE INDEX "idx_products_brand_product_handle" ON "public"."products" USING "btree" ("brand_id", "product_handle");



CREATE INDEX "idx_products_brand_season" ON "public"."products" USING "btree" ("brand_id", "season_id");



CREATE INDEX "idx_products_brand_status" ON "public"."products" USING "btree" ("brand_id", "status");



CREATE INDEX "idx_products_name" ON "public"."products" USING "btree" ("name");



CREATE UNIQUE INDEX "idx_unique_upid_per_brand" ON "public"."product_variants" USING "btree" ("upid", "public"."get_product_brand_id"("product_id")) WHERE (("upid" IS NOT NULL) AND ("upid" <> ''::"text"));



CREATE INDEX "idx_users_brand_id" ON "public"."users" USING "btree" ("brand_id") WHERE ("brand_id" IS NOT NULL);



CREATE INDEX "idx_brand_members_brand_id" ON "public"."brand_members" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_members_user_id" ON "public"."brand_members" USING "btree" ("user_id");



CREATE INDEX "idx_variant_eco_claims_variant_id" ON "public"."variant_eco_claims" USING "btree" ("variant_id");



CREATE INDEX "idx_variant_journey_steps_variant_id" ON "public"."variant_journey_steps" USING "btree" ("variant_id");



CREATE INDEX "idx_variant_journey_steps_variant_sort" ON "public"."variant_journey_steps" USING "btree" ("variant_id", "sort_index");



CREATE INDEX "idx_variant_materials_variant_id" ON "public"."variant_materials" USING "btree" ("variant_id");



CREATE UNIQUE INDEX "import_rows_job_row_unq" ON "public"."import_rows" USING "btree" ("job_id", "row_number");



CREATE UNIQUE INDEX "integration_certification_links_integration_cert_unq" ON "public"."integration_certification_links" USING "btree" ("brand_integration_id", "certification_id");



CREATE UNIQUE INDEX "integration_certification_links_integration_external_unq" ON "public"."integration_certification_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integration_eco_claim_links_integration_claim_unq" ON "public"."integration_eco_claim_links" USING "btree" ("brand_integration_id", "eco_claim_id");



CREATE UNIQUE INDEX "integration_eco_claim_links_integration_external_unq" ON "public"."integration_eco_claim_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integration_facility_links_integration_external_unq" ON "public"."integration_facility_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integration_facility_links_integration_facility_unq" ON "public"."integration_facility_links" USING "btree" ("brand_integration_id", "facility_id");



CREATE UNIQUE INDEX "integration_field_configs_integration_field_unq" ON "public"."integration_field_configs" USING "btree" ("brand_integration_id", "field_key");



CREATE UNIQUE INDEX "integration_manufacturer_links_integration_external_unq" ON "public"."integration_manufacturer_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integration_manufacturer_links_integration_mfr_unq" ON "public"."integration_manufacturer_links" USING "btree" ("brand_integration_id", "manufacturer_id");



CREATE UNIQUE INDEX "integration_material_links_integration_external_unq" ON "public"."integration_material_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integration_material_links_integration_material_unq" ON "public"."integration_material_links" USING "btree" ("brand_integration_id", "material_id");



CREATE UNIQUE INDEX "integration_product_links_integration_external_unq" ON "public"."integration_product_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integration_product_links_integration_product_unq" ON "public"."integration_product_links" USING "btree" ("brand_integration_id", "product_id");



CREATE UNIQUE INDEX "integration_season_links_integration_external_unq" ON "public"."integration_season_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integration_season_links_integration_season_unq" ON "public"."integration_season_links" USING "btree" ("brand_integration_id", "season_id");



CREATE UNIQUE INDEX "integration_tag_links_integration_external_unq" ON "public"."integration_tag_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integration_tag_links_integration_tag_unq" ON "public"."integration_tag_links" USING "btree" ("brand_integration_id", "tag_id");



CREATE UNIQUE INDEX "integration_variant_links_integration_external_unq" ON "public"."integration_variant_links" USING "btree" ("brand_integration_id", "external_id");



CREATE UNIQUE INDEX "integrations_slug_unq" ON "public"."integrations" USING "btree" ("slug");



CREATE UNIQUE INDEX "product_eco_claims_unique" ON "public"."product_eco_claims" USING "btree" ("product_id", "eco_claim_id");



CREATE UNIQUE INDEX "product_journey_steps_product_sort_unq" ON "public"."product_journey_steps" USING "btree" ("product_id", "sort_index");



CREATE UNIQUE INDEX "product_materials_product_material_unq" ON "public"."product_materials" USING "btree" ("product_id", "brand_material_id");



CREATE UNIQUE INDEX "products_brand_id_product_handle_unq" ON "public"."products" USING "btree" ("brand_id", "product_handle");



CREATE INDEX "staging_product_eco_claims_job_id_idx" ON "public"."staging_product_eco_claims" USING "btree" ("job_id");



CREATE INDEX "staging_product_eco_claims_staging_product_id_idx" ON "public"."staging_product_eco_claims" USING "btree" ("staging_product_id");



CREATE UNIQUE INDEX "staging_product_eco_claims_unique" ON "public"."staging_product_eco_claims" USING "btree" ("staging_product_id", "eco_claim_id");



CREATE INDEX "staging_product_environment_job_id_idx" ON "public"."staging_product_environment" USING "btree" ("job_id");



CREATE INDEX "staging_product_environment_staging_product_id_idx" ON "public"."staging_product_environment" USING "btree" ("staging_product_id");



CREATE UNIQUE INDEX "staging_product_environment_unique" ON "public"."staging_product_environment" USING "btree" ("staging_product_id");



CREATE INDEX "staging_product_journey_steps_job_id_idx" ON "public"."staging_product_journey_steps" USING "btree" ("job_id");



CREATE INDEX "staging_product_journey_steps_staging_product_id_idx" ON "public"."staging_product_journey_steps" USING "btree" ("staging_product_id");



CREATE UNIQUE INDEX "staging_product_journey_steps_unique" ON "public"."staging_product_journey_steps" USING "btree" ("staging_product_id", "sort_index");



CREATE INDEX "staging_product_materials_job_id_idx" ON "public"."staging_product_materials" USING "btree" ("job_id");



CREATE INDEX "staging_product_materials_staging_product_id_idx" ON "public"."staging_product_materials" USING "btree" ("staging_product_id");



CREATE UNIQUE INDEX "staging_product_materials_unique" ON "public"."staging_product_materials" USING "btree" ("staging_product_id", "brand_material_id");



CREATE INDEX "staging_product_tags_job_id_idx" ON "public"."staging_product_tags" USING "btree" ("job_id");



CREATE INDEX "staging_product_tags_staging_product_id_idx" ON "public"."staging_product_tags" USING "btree" ("staging_product_id");



CREATE UNIQUE INDEX "staging_product_tags_unique" ON "public"."staging_product_tags" USING "btree" ("staging_product_id", "tag_id");



CREATE INDEX "staging_product_variants_action_idx" ON "public"."staging_product_variants" USING "btree" ("action");



CREATE INDEX "staging_product_variants_existing_variant_id_idx" ON "public"."staging_product_variants" USING "btree" ("existing_variant_id");



CREATE INDEX "staging_product_variants_job_id_idx" ON "public"."staging_product_variants" USING "btree" ("job_id");



CREATE UNIQUE INDEX "staging_product_variants_job_row_unq" ON "public"."staging_product_variants" USING "btree" ("job_id", "row_number");



CREATE INDEX "staging_product_variants_staging_product_id_idx" ON "public"."staging_product_variants" USING "btree" ("staging_product_id");



CREATE INDEX "staging_product_variants_upid_idx" ON "public"."staging_product_variants" USING "btree" ("upid");



CREATE INDEX "staging_products_action_idx" ON "public"."staging_products" USING "btree" ("action");



CREATE INDEX "staging_products_brand_id_idx" ON "public"."staging_products" USING "btree" ("brand_id");



CREATE INDEX "staging_products_existing_product_id_idx" ON "public"."staging_products" USING "btree" ("existing_product_id");



CREATE INDEX "staging_products_job_id_idx" ON "public"."staging_products" USING "btree" ("job_id");



CREATE UNIQUE INDEX "staging_products_job_row_unq" ON "public"."staging_products" USING "btree" ("job_id", "row_number");



CREATE INDEX "tags_on_product_product_id_idx" ON "public"."product_tags" USING "btree" ("product_id");



CREATE INDEX "tags_on_product_tag_id_idx" ON "public"."product_tags" USING "btree" ("tag_id");



CREATE UNIQUE INDEX "tags_on_product_tag_product_unq" ON "public"."product_tags" USING "btree" ("tag_id", "product_id");



CREATE INDEX "taxonomy_attributes_friendly_id_idx" ON "public"."taxonomy_attributes" USING "btree" ("friendly_id");



CREATE UNIQUE INDEX "taxonomy_external_mappings_slug_unq" ON "public"."taxonomy_external_mappings" USING "btree" ("slug");



CREATE INDEX "taxonomy_external_mappings_source_idx" ON "public"."taxonomy_external_mappings" USING "btree" ("source_system", "source_taxonomy");



CREATE INDEX "taxonomy_values_attribute_id_idx" ON "public"."taxonomy_values" USING "btree" ("attribute_id");



CREATE INDEX "taxonomy_values_friendly_id_idx" ON "public"."taxonomy_values" USING "btree" ("friendly_id");



CREATE UNIQUE INDEX "ux_brand_invites_token_hash_not_null" ON "public"."brand_invites" USING "btree" ("token_hash") WHERE ("token_hash" IS NOT NULL);



CREATE UNIQUE INDEX "ux_brand_members_user_brand" ON "public"."brand_members" USING "btree" ("user_id", "brand_id");



CREATE UNIQUE INDEX "value_mappings_brand_col_raw_unq" ON "public"."value_mappings" USING "btree" ("brand_id", "source_column", "raw_value");



CREATE UNIQUE INDEX "variant_eco_claims_unique" ON "public"."variant_eco_claims" USING "btree" ("variant_id", "eco_claim_id");



CREATE UNIQUE INDEX "variant_journey_steps_variant_sort_unq" ON "public"."variant_journey_steps" USING "btree" ("variant_id", "sort_index");



CREATE UNIQUE INDEX "variant_materials_variant_material_unq" ON "public"."variant_materials" USING "btree" ("variant_id", "brand_material_id");



CREATE OR REPLACE TRIGGER "update_brand_invites_updated_at" BEFORE UPDATE ON "public"."brand_invites" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_brands_updated_at" BEFORE UPDATE ON "public"."brands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_brand_members_updated_at" BEFORE UPDATE ON "public"."brand_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."brand_attribute_values"
    ADD CONSTRAINT "brand_attribute_values_attribute_id_brand_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."brand_attributes"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_attribute_values"
    ADD CONSTRAINT "brand_attribute_values_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_attribute_values"
    ADD CONSTRAINT "brand_attribute_values_taxonomy_value_id_taxonomy_values_id_fk" FOREIGN KEY ("taxonomy_value_id") REFERENCES "public"."taxonomy_values"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_attributes"
    ADD CONSTRAINT "brand_attributes_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_attributes"
    ADD CONSTRAINT "brand_attributes_taxonomy_attribute_id_taxonomy_attributes_id_f" FOREIGN KEY ("taxonomy_attribute_id") REFERENCES "public"."taxonomy_attributes"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_certifications"
    ADD CONSTRAINT "brand_certifications_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_collections"
    ADD CONSTRAINT "brand_collections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_eco_claims"
    ADD CONSTRAINT "brand_eco_claims_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_facilities"
    ADD CONSTRAINT "brand_facilities_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_integrations"
    ADD CONSTRAINT "brand_integrations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_integrations"
    ADD CONSTRAINT "brand_integrations_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_invites"
    ADD CONSTRAINT "brand_invites_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_manufacturers"
    ADD CONSTRAINT "brand_manufacturers_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_materials"
    ADD CONSTRAINT "brand_materials_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_materials"
    ADD CONSTRAINT "brand_materials_certification_id_brand_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."brand_certifications"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_members"
    ADD CONSTRAINT "brand_members_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_members"
    ADD CONSTRAINT "brand_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_seasons"
    ADD CONSTRAINT "brand_seasons_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_tags"
    ADD CONSTRAINT "brand_tags_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_theme"
    ADD CONSTRAINT "brand_theme_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_assets"
    ADD CONSTRAINT "file_assets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_rows"
    ADD CONSTRAINT "import_rows_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_certification_links"
    ADD CONSTRAINT "integration_certification_links_brand_integration_id_brand_inte" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_certification_links"
    ADD CONSTRAINT "integration_certification_links_certification_id_brand_certific" FOREIGN KEY ("certification_id") REFERENCES "public"."brand_certifications"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_eco_claim_links"
    ADD CONSTRAINT "integration_eco_claim_links_brand_integration_id_brand_integrat" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_eco_claim_links"
    ADD CONSTRAINT "integration_eco_claim_links_eco_claim_id_brand_eco_claims_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_facility_links"
    ADD CONSTRAINT "integration_facility_links_brand_integration_id_brand_integrati" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_facility_links"
    ADD CONSTRAINT "integration_facility_links_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_field_configs"
    ADD CONSTRAINT "integration_field_configs_brand_integration_id_brand_integratio" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_manufacturer_links"
    ADD CONSTRAINT "integration_manufacturer_links_brand_integration_id_brand_integ" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_manufacturer_links"
    ADD CONSTRAINT "integration_manufacturer_links_manufacturer_id_brand_manufactur" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."brand_manufacturers"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_material_links"
    ADD CONSTRAINT "integration_material_links_brand_integration_id_brand_integrati" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_material_links"
    ADD CONSTRAINT "integration_material_links_material_id_brand_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."brand_materials"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_product_links"
    ADD CONSTRAINT "integration_product_links_brand_integration_id_brand_integratio" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_product_links"
    ADD CONSTRAINT "integration_product_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_season_links"
    ADD CONSTRAINT "integration_season_links_brand_integration_id_brand_integration" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_season_links"
    ADD CONSTRAINT "integration_season_links_season_id_brand_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."brand_seasons"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_sync_jobs"
    ADD CONSTRAINT "integration_sync_jobs_brand_integration_id_brand_integrations_i" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_tag_links"
    ADD CONSTRAINT "integration_tag_links_brand_integration_id_brand_integrations_i" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_tag_links"
    ADD CONSTRAINT "integration_tag_links_tag_id_brand_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."brand_tags"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_variant_links"
    ADD CONSTRAINT "integration_variant_links_brand_integration_id_brand_integratio" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_variant_links"
    ADD CONSTRAINT "integration_variant_links_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_commercial"
    ADD CONSTRAINT "product_commercial_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_eco_claims"
    ADD CONSTRAINT "product_eco_claims_eco_claim_id_brand_eco_claims_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_eco_claims"
    ADD CONSTRAINT "product_eco_claims_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_environment"
    ADD CONSTRAINT "product_environment_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_journey_steps"
    ADD CONSTRAINT "product_journey_steps_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_journey_steps"
    ADD CONSTRAINT "product_journey_steps_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_materials"
    ADD CONSTRAINT "product_materials_brand_material_id_brand_materials_id_fk" FOREIGN KEY ("brand_material_id") REFERENCES "public"."brand_materials"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_materials"
    ADD CONSTRAINT "product_materials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_tags"
    ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_tags"
    ADD CONSTRAINT "product_tags_tag_id_brand_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."brand_tags"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variant_attributes"
    ADD CONSTRAINT "product_variant_attributes_attribute_value_id_brand_attribute_v" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."brand_attribute_values"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variant_attributes"
    ADD CONSTRAINT "product_variant_attributes_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_weight"
    ADD CONSTRAINT "product_weight_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_taxonomy_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."taxonomy_categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_manufacturer_id_brand_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."brand_manufacturers"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_season_id_brand_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."brand_seasons"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staging_product_eco_claims"
    ADD CONSTRAINT "staging_product_eco_claims_eco_claim_id_brand_eco_claims_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staging_product_eco_claims"
    ADD CONSTRAINT "staging_product_eco_claims_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_eco_claims"
    ADD CONSTRAINT "staging_product_eco_claims_staging_product_id_staging_products_" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_environment"
    ADD CONSTRAINT "staging_product_environment_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_environment"
    ADD CONSTRAINT "staging_product_environment_staging_product_id_staging_products" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_journey_steps"
    ADD CONSTRAINT "staging_product_journey_steps_facility_id_brand_facilities_id_f" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staging_product_journey_steps"
    ADD CONSTRAINT "staging_product_journey_steps_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_journey_steps"
    ADD CONSTRAINT "staging_product_journey_steps_staging_product_id_staging_produc" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_materials"
    ADD CONSTRAINT "staging_product_materials_brand_material_id_brand_materials_id_" FOREIGN KEY ("brand_material_id") REFERENCES "public"."brand_materials"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staging_product_materials"
    ADD CONSTRAINT "staging_product_materials_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_materials"
    ADD CONSTRAINT "staging_product_materials_staging_product_id_staging_products_s" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_tags"
    ADD CONSTRAINT "staging_product_tags_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_tags"
    ADD CONSTRAINT "staging_product_tags_staging_product_id_staging_products_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_tags"
    ADD CONSTRAINT "staging_product_tags_tag_id_brand_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."brand_tags"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staging_product_variants"
    ADD CONSTRAINT "staging_product_variants_existing_variant_id_product_variants_i" FOREIGN KEY ("existing_variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_variants"
    ADD CONSTRAINT "staging_product_variants_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_product_variants"
    ADD CONSTRAINT "staging_product_variants_staging_product_id_staging_products_st" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_products"
    ADD CONSTRAINT "staging_products_existing_product_id_products_id_fk" FOREIGN KEY ("existing_product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_products"
    ADD CONSTRAINT "staging_products_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."taxonomy_categories"
    ADD CONSTRAINT "taxonomy_categories_parent_id_taxonomy_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."taxonomy_categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."taxonomy_values"
    ADD CONSTRAINT "taxonomy_values_attribute_id_taxonomy_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."taxonomy_attributes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."value_mappings"
    ADD CONSTRAINT "value_mappings_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_commercial"
    ADD CONSTRAINT "variant_commercial_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_eco_claims"
    ADD CONSTRAINT "variant_eco_claims_eco_claim_id_brand_eco_claims_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."variant_eco_claims"
    ADD CONSTRAINT "variant_eco_claims_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_environment"
    ADD CONSTRAINT "variant_environment_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_journey_steps"
    ADD CONSTRAINT "variant_journey_steps_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."variant_journey_steps"
    ADD CONSTRAINT "variant_journey_steps_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_materials"
    ADD CONSTRAINT "variant_materials_brand_material_id_brand_materials_id_fk" FOREIGN KEY ("brand_material_id") REFERENCES "public"."brand_materials"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."variant_materials"
    ADD CONSTRAINT "variant_materials_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_weight"
    ADD CONSTRAINT "variant_weight_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE "public"."brand_attribute_values" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_attribute_values_delete_by_brand_member" ON "public"."brand_attribute_values" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_attribute_values_insert_by_brand_member" ON "public"."brand_attribute_values" FOR INSERT TO "authenticated", "service_role" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_attribute_values_select_for_brand_members" ON "public"."brand_attribute_values" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_attribute_values_update_by_brand_member" ON "public"."brand_attribute_values" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_attributes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_attributes_delete_by_brand_member" ON "public"."brand_attributes" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_attributes_insert_by_brand_member" ON "public"."brand_attributes" FOR INSERT TO "authenticated", "service_role" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_attributes_select_for_brand_members" ON "public"."brand_attributes" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_attributes_update_by_brand_member" ON "public"."brand_attributes" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_certifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_certifications_delete_by_brand_member" ON "public"."brand_certifications" FOR DELETE TO "authenticated" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_certifications_insert_by_brand_member" ON "public"."brand_certifications" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_certifications_select_for_brand_members" ON "public"."brand_certifications" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_certifications_update_by_brand_member" ON "public"."brand_certifications" FOR UPDATE TO "authenticated" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_collections_delete_by_brand_member" ON "public"."brand_collections" FOR DELETE TO "authenticated" USING ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "brand_collections_insert_by_brand_member" ON "public"."brand_collections" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "brand_collections_select_for_brand_members" ON "public"."brand_collections" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_collections_update_by_brand_member" ON "public"."brand_collections" FOR UPDATE TO "authenticated" USING ("public"."is_brand_owner"("brand_id"));



ALTER TABLE "public"."brand_eco_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_eco_claims_delete_by_brand_member" ON "public"."brand_eco_claims" FOR DELETE TO "authenticated" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_eco_claims_insert_by_brand_member" ON "public"."brand_eco_claims" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_eco_claims_select_for_brand_members" ON "public"."brand_eco_claims" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_eco_claims_update_by_brand_member" ON "public"."brand_eco_claims" FOR UPDATE TO "authenticated" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_facilities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_facilities_delete_by_brand_member" ON "public"."brand_facilities" FOR DELETE TO "authenticated" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_facilities_insert_by_brand_member" ON "public"."brand_facilities" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_facilities_select_for_brand_members" ON "public"."brand_facilities" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_facilities_update_by_brand_member" ON "public"."brand_facilities" FOR UPDATE TO "authenticated" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_integrations_delete_by_brand_member" ON "public"."brand_integrations" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_integrations_insert_by_brand_member" ON "public"."brand_integrations" FOR INSERT TO "authenticated", "service_role" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_integrations_select_for_brand_members" ON "public"."brand_integrations" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_integrations_update_by_brand_member" ON "public"."brand_integrations" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_invites_delete_by_owner" ON "public"."brand_invites" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "brand_invites_delete_by_recipient" ON "public"."brand_invites" FOR DELETE TO "authenticated", "service_role" USING (("lower"(TRIM(BOTH FROM "email")) = "lower"(TRIM(BOTH FROM COALESCE(( SELECT "auth"."email"() AS "email"), ( SELECT ("auth"."jwt"() ->> 'email'::"text")))))));



CREATE POLICY "brand_invites_insert_by_owner" ON "public"."brand_invites" FOR INSERT TO "authenticated", "service_role" WITH CHECK ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "brand_invites_select_for_members" ON "public"."brand_invites" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_invites_select_for_recipient" ON "public"."brand_invites" FOR SELECT TO "authenticated", "service_role" USING (("lower"(TRIM(BOTH FROM "email")) = "lower"(TRIM(BOTH FROM COALESCE(( SELECT "auth"."email"() AS "email"), ( SELECT ("auth"."jwt"() ->> 'email'::"text")))))));



CREATE POLICY "brand_invites_update_by_owner" ON "public"."brand_invites" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_owner"("brand_id"));



ALTER TABLE "public"."brand_manufacturers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_manufacturers_delete_by_brand_member" ON "public"."brand_manufacturers" FOR DELETE TO "authenticated" USING ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "brand_manufacturers_insert_by_brand_member" ON "public"."brand_manufacturers" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "brand_manufacturers_select_for_brand_members" ON "public"."brand_manufacturers" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_manufacturers_update_by_brand_member" ON "public"."brand_manufacturers" FOR UPDATE TO "authenticated" USING ("public"."is_brand_owner"("brand_id"));



ALTER TABLE "public"."brand_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_materials_delete_by_brand_member" ON "public"."brand_materials" FOR DELETE TO "authenticated" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_materials_insert_by_brand_member" ON "public"."brand_materials" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_materials_select_for_brand_members" ON "public"."brand_materials" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_materials_update_by_brand_member" ON "public"."brand_materials" FOR UPDATE TO "authenticated" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_seasons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_seasons_delete_by_brand_members" ON "public"."brand_seasons" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_seasons_insert_by_brand_members" ON "public"."brand_seasons" FOR INSERT TO "authenticated", "service_role" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_seasons_select_for_brand_members" ON "public"."brand_seasons" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_seasons_update_by_brand_members" ON "public"."brand_seasons" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_tags_delete_by_brand_members" ON "public"."brand_tags" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_tags_insert_by_brand_members" ON "public"."brand_tags" FOR INSERT TO "authenticated", "service_role" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_tags_select_for_brand_members" ON "public"."brand_tags" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_tags_update_by_brand_members" ON "public"."brand_tags" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brand_theme" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_theme_delete_by_brand_member" ON "public"."brand_theme" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_theme_insert_by_brand_member" ON "public"."brand_theme" FOR INSERT TO "authenticated", "service_role" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_theme_select_for_brand_members" ON "public"."brand_theme" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_theme_update_by_brand_member" ON "public"."brand_theme" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id")) WITH CHECK ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands_delete_by_owner" ON "public"."brands" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_owner"("id"));



CREATE POLICY "brands_insert_by_authenticated" ON "public"."brands" FOR INSERT TO "authenticated", "service_role" WITH CHECK (true);



CREATE POLICY "brands_select_for_invite_recipients" ON "public"."brands" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_invites" "bi"
  WHERE (("bi"."brand_id" = "brands"."id") AND (("bi"."expires_at" IS NULL) OR ("bi"."expires_at" > "now"())) AND ("lower"(TRIM(BOTH FROM "bi"."email")) = "lower"(TRIM(BOTH FROM COALESCE(( SELECT "auth"."email"() AS "email"), ( SELECT ("auth"."jwt"() ->> 'email'::"text"))))))))));



CREATE POLICY "brands_select_for_members" ON "public"."brands" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("id"));



CREATE POLICY "brands_update_by_member" ON "public"."brands" FOR UPDATE TO "authenticated" USING ("public"."is_brand_owner"("id"));



CREATE POLICY "categories_modify_system_only" ON "public"."taxonomy_categories" AS RESTRICTIVE TO "authenticated", "service_role" USING (false) WITH CHECK (false);



CREATE POLICY "categories_select_for_authenticated" ON "public"."taxonomy_categories" FOR SELECT TO "authenticated", "service_role" USING (true);



ALTER TABLE "public"."file_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "file_assets_delete_by_brand_member_or_system" ON "public"."file_assets" FOR DELETE TO "authenticated" USING ((("brand_id" IS NULL) OR "public"."is_brand_owner"("brand_id")));



CREATE POLICY "file_assets_insert_by_brand_member_or_system" ON "public"."file_assets" FOR INSERT TO "authenticated" WITH CHECK ((("brand_id" IS NULL) OR "public"."is_brand_owner"("brand_id")));



CREATE POLICY "file_assets_select_for_brand_members" ON "public"."file_assets" FOR SELECT TO "authenticated", "service_role" USING ((("brand_id" IS NULL) OR "public"."is_brand_member"("brand_id")));



CREATE POLICY "file_assets_update_by_brand_member_or_system" ON "public"."file_assets" FOR UPDATE TO "authenticated" USING ((("brand_id" IS NULL) OR "public"."is_brand_owner"("brand_id")));



ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_jobs_delete_by_brand_member" ON "public"."import_jobs" FOR DELETE TO "authenticated" USING ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "import_jobs_insert_by_brand_member" ON "public"."import_jobs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "import_jobs_select_for_brand_members" ON "public"."import_jobs" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "import_jobs_update_by_brand_member" ON "public"."import_jobs" FOR UPDATE TO "authenticated" USING ("public"."is_brand_owner"("brand_id"));



ALTER TABLE "public"."import_rows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_rows_delete_by_brand_member" ON "public"."import_rows" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_rows"."job_id") AND "public"."is_brand_owner"("import_jobs"."brand_id")))));



CREATE POLICY "import_rows_insert_by_brand_member" ON "public"."import_rows" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_rows"."job_id") AND "public"."is_brand_owner"("import_jobs"."brand_id")))));



CREATE POLICY "import_rows_select_for_brand_members" ON "public"."import_rows" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_rows"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "import_rows_update_by_brand_member" ON "public"."import_rows" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_rows"."job_id") AND "public"."is_brand_owner"("import_jobs"."brand_id")))));



ALTER TABLE "public"."integration_certification_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_certification_links_delete_by_brand_member" ON "public"."integration_certification_links" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_certification_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_certification_links_insert_by_brand_member" ON "public"."integration_certification_links" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_certification_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_certification_links_select_for_brand_members" ON "public"."integration_certification_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_certification_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_certification_links_update_by_brand_member" ON "public"."integration_certification_links" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_certification_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_eco_claim_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_eco_claim_links_delete_by_brand_member" ON "public"."integration_eco_claim_links" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_eco_claim_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_eco_claim_links_insert_by_brand_member" ON "public"."integration_eco_claim_links" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_eco_claim_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_eco_claim_links_select_for_brand_members" ON "public"."integration_eco_claim_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_eco_claim_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_eco_claim_links_update_by_brand_member" ON "public"."integration_eco_claim_links" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_eco_claim_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_facility_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_facility_links_delete_by_brand_member" ON "public"."integration_facility_links" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_facility_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_facility_links_insert_by_brand_member" ON "public"."integration_facility_links" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_facility_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_facility_links_select_for_brand_members" ON "public"."integration_facility_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_facility_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_facility_links_update_by_brand_member" ON "public"."integration_facility_links" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_facility_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_field_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_field_configs_delete_by_brand_member" ON "public"."integration_field_configs" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_field_configs"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_field_configs_insert_by_brand_member" ON "public"."integration_field_configs" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_field_configs"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_field_configs_select_for_brand_members" ON "public"."integration_field_configs" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_field_configs"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_field_configs_update_by_brand_member" ON "public"."integration_field_configs" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_field_configs"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_manufacturer_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_manufacturer_links_delete_by_brand_member" ON "public"."integration_manufacturer_links" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_manufacturer_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_manufacturer_links_insert_by_brand_member" ON "public"."integration_manufacturer_links" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_manufacturer_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_manufacturer_links_select_for_brand_members" ON "public"."integration_manufacturer_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_manufacturer_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_manufacturer_links_update_by_brand_member" ON "public"."integration_manufacturer_links" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_manufacturer_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_material_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_material_links_delete_by_brand_member" ON "public"."integration_material_links" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_material_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_material_links_insert_by_brand_member" ON "public"."integration_material_links" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_material_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_material_links_select_for_brand_members" ON "public"."integration_material_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_material_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_material_links_update_by_brand_member" ON "public"."integration_material_links" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_material_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_product_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_product_links_delete_by_brand_member" ON "public"."integration_product_links" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_product_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_product_links_insert_by_brand_member" ON "public"."integration_product_links" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_product_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_product_links_select_for_brand_members" ON "public"."integration_product_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_product_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_product_links_update_by_brand_member" ON "public"."integration_product_links" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_product_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_season_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_season_links_delete_by_brand_member" ON "public"."integration_season_links" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_season_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_season_links_insert_by_brand_member" ON "public"."integration_season_links" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_season_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_season_links_select_for_brand_members" ON "public"."integration_season_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_season_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_season_links_update_by_brand_member" ON "public"."integration_season_links" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_season_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_sync_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_sync_jobs_delete_by_brand_member" ON "public"."integration_sync_jobs" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_sync_jobs"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_sync_jobs_insert_by_brand_member" ON "public"."integration_sync_jobs" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_sync_jobs"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_sync_jobs_select_for_brand_members" ON "public"."integration_sync_jobs" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_sync_jobs"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_sync_jobs_update_by_brand_member" ON "public"."integration_sync_jobs" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_sync_jobs"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_tag_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_tag_links_delete_by_brand_member" ON "public"."integration_tag_links" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_tag_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_tag_links_insert_by_brand_member" ON "public"."integration_tag_links" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_tag_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_tag_links_select_for_brand_members" ON "public"."integration_tag_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_tag_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_tag_links_update_by_brand_member" ON "public"."integration_tag_links" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_tag_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



ALTER TABLE "public"."integration_variant_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_variant_links_delete_by_service" ON "public"."integration_variant_links" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "integration_variant_links_insert_by_service" ON "public"."integration_variant_links" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "integration_variant_links_select_for_brand_members" ON "public"."integration_variant_links" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."brand_integrations" "bi"
  WHERE (("bi"."id" = "integration_variant_links"."brand_integration_id") AND "public"."is_brand_member"("bi"."brand_id")))));



CREATE POLICY "integration_variant_links_update_by_service" ON "public"."integration_variant_links" FOR UPDATE TO "service_role" USING (true);



ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integrations_delete_by_service_role" ON "public"."integrations" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "integrations_insert_by_service_role" ON "public"."integrations" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "integrations_select_for_authenticated" ON "public"."integrations" FOR SELECT TO "authenticated", "service_role" USING (true);



CREATE POLICY "integrations_update_by_service_role" ON "public"."integrations" FOR UPDATE TO "service_role" USING (true);



ALTER TABLE "public"."oauth_states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "oauth_states_delete_by_service_role" ON "public"."oauth_states" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "oauth_states_insert_by_service_role" ON "public"."oauth_states" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "oauth_states_select_by_service_role" ON "public"."oauth_states" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "oauth_states_update_by_service_role" ON "public"."oauth_states" FOR UPDATE TO "service_role" USING (true);



ALTER TABLE "public"."product_commercial" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_commercial_delete_by_brand_member" ON "public"."product_commercial" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_commercial"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_commercial_insert_by_brand_member" ON "public"."product_commercial" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_commercial"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_commercial_select_for_brand_members" ON "public"."product_commercial" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_commercial"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_commercial_update_by_brand_member" ON "public"."product_commercial" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_commercial"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



ALTER TABLE "public"."product_eco_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_eco_claims_delete_by_brand_member" ON "public"."product_eco_claims" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_eco_claims"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_eco_claims_insert_by_brand_member" ON "public"."product_eco_claims" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_eco_claims"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_eco_claims_select_for_brand_members" ON "public"."product_eco_claims" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_eco_claims"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_eco_claims_update_by_brand_member" ON "public"."product_eco_claims" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_eco_claims"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



ALTER TABLE "public"."product_environment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_environment_delete_by_brand_member" ON "public"."product_environment" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_environment"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_environment_insert_by_brand_member" ON "public"."product_environment" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_environment"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_environment_select_for_brand_members" ON "public"."product_environment" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_environment"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_environment_update_by_brand_member" ON "public"."product_environment" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_environment"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



ALTER TABLE "public"."product_journey_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_journey_steps_delete_by_brand_member" ON "public"."product_journey_steps" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_journey_steps"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_journey_steps_insert_by_brand_member" ON "public"."product_journey_steps" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_journey_steps"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_journey_steps_select_for_brand_members" ON "public"."product_journey_steps" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_journey_steps"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_journey_steps_update_by_brand_member" ON "public"."product_journey_steps" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_journey_steps"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



ALTER TABLE "public"."product_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_materials_delete_by_brand_member" ON "public"."product_materials" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_materials"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_materials_insert_by_brand_member" ON "public"."product_materials" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_materials"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_materials_select_for_brand_members" ON "public"."product_materials" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_materials"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_materials_update_by_brand_member" ON "public"."product_materials" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_materials"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



ALTER TABLE "public"."product_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_variant_attributes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_variant_attributes_delete_by_brand_member" ON "public"."product_variant_attributes" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "product_variant_attributes"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "product_variant_attributes_insert_by_brand_member" ON "public"."product_variant_attributes" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "product_variant_attributes"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "product_variant_attributes_select_for_brand_members" ON "public"."product_variant_attributes" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "product_variant_attributes"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "product_variant_attributes_update_by_brand_member" ON "public"."product_variant_attributes" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "product_variant_attributes"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



ALTER TABLE "public"."product_variants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_variants_delete_by_brand_member" ON "public"."product_variants" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_variants"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_variants_insert_by_brand_member" ON "public"."product_variants" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_variants"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_variants_select_for_brand_members" ON "public"."product_variants" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_variants"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_variants_update_by_brand_member" ON "public"."product_variants" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_variants"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



ALTER TABLE "public"."product_weight" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_weight_delete_by_brand_member" ON "public"."product_weight" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_weight"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_weight_insert_by_brand_member" ON "public"."product_weight" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_weight"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_weight_select_for_brand_members" ON "public"."product_weight" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_weight"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "product_weight_update_by_brand_member" ON "public"."product_weight" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_weight"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_delete_by_brand_members" ON "public"."products" FOR DELETE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "products_insert_by_brand_members" ON "public"."products" FOR INSERT TO "authenticated", "service_role" WITH CHECK ("public"."is_brand_member"("brand_id"));



CREATE POLICY "products_select_for_brand_members" ON "public"."products" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "products_update_by_brand_members" ON "public"."products" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



ALTER TABLE "public"."staging_product_eco_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_product_eco_claims_delete_by_system" ON "public"."staging_product_eco_claims" FOR DELETE TO "authenticated", "service_role";



CREATE POLICY "staging_product_eco_claims_insert_by_system" ON "public"."staging_product_eco_claims" FOR INSERT TO "authenticated", "service_role";



CREATE POLICY "staging_product_eco_claims_select_for_brand_members" ON "public"."staging_product_eco_claims" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_eco_claims"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_product_eco_claims_update_by_system" ON "public"."staging_product_eco_claims" FOR UPDATE TO "authenticated", "service_role";



ALTER TABLE "public"."staging_product_environment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_product_environment_delete_by_system" ON "public"."staging_product_environment" FOR DELETE TO "authenticated", "service_role";



CREATE POLICY "staging_product_environment_insert_by_system" ON "public"."staging_product_environment" FOR INSERT TO "authenticated", "service_role";



CREATE POLICY "staging_product_environment_select_for_brand_members" ON "public"."staging_product_environment" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_environment"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_product_environment_update_by_system" ON "public"."staging_product_environment" FOR UPDATE TO "authenticated", "service_role";



ALTER TABLE "public"."staging_product_journey_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_product_journey_steps_delete_by_system" ON "public"."staging_product_journey_steps" FOR DELETE TO "authenticated", "service_role";



CREATE POLICY "staging_product_journey_steps_insert_by_system" ON "public"."staging_product_journey_steps" FOR INSERT TO "authenticated", "service_role";



CREATE POLICY "staging_product_journey_steps_select_for_brand_members" ON "public"."staging_product_journey_steps" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_journey_steps"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_product_journey_steps_update_by_system" ON "public"."staging_product_journey_steps" FOR UPDATE TO "authenticated", "service_role";



ALTER TABLE "public"."staging_product_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_product_materials_delete_by_system" ON "public"."staging_product_materials" FOR DELETE TO "authenticated", "service_role";



CREATE POLICY "staging_product_materials_insert_by_system" ON "public"."staging_product_materials" FOR INSERT TO "authenticated", "service_role";



CREATE POLICY "staging_product_materials_select_for_brand_members" ON "public"."staging_product_materials" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_materials"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_product_materials_update_by_system" ON "public"."staging_product_materials" FOR UPDATE TO "authenticated", "service_role";



ALTER TABLE "public"."staging_product_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_product_tags_delete_by_system" ON "public"."staging_product_tags" FOR DELETE TO "authenticated", "service_role";



CREATE POLICY "staging_product_tags_insert_by_system" ON "public"."staging_product_tags" FOR INSERT TO "authenticated", "service_role";



CREATE POLICY "staging_product_tags_select_for_brand_members" ON "public"."staging_product_tags" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_tags"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_product_tags_update_by_system" ON "public"."staging_product_tags" FOR UPDATE TO "authenticated", "service_role";



ALTER TABLE "public"."staging_product_variants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_product_variants_delete_by_system" ON "public"."staging_product_variants" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_variants"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_product_variants_insert_by_system" ON "public"."staging_product_variants" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_variants"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_product_variants_select_for_brand_members" ON "public"."staging_product_variants" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_variants"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_product_variants_update_by_system" ON "public"."staging_product_variants" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_product_variants"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



ALTER TABLE "public"."staging_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_products_delete_by_system" ON "public"."staging_products" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_products"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_products_insert_by_system" ON "public"."staging_products" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_products"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "staging_products_select_for_brand_members" ON "public"."staging_products" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "staging_products_update_by_system" ON "public"."staging_products" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "staging_products"."job_id") AND "public"."is_brand_member"("import_jobs"."brand_id")))));



CREATE POLICY "tags_on_product_delete_by_brand_members" ON "public"."product_tags" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_tags"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "tags_on_product_insert_by_brand_members" ON "public"."product_tags" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_tags"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



CREATE POLICY "tags_on_product_select_for_brand_members" ON "public"."product_tags" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_tags"."product_id") AND "public"."is_brand_member"("products"."brand_id")))));



ALTER TABLE "public"."taxonomy_attributes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taxonomy_attributes_select_for_authenticated" ON "public"."taxonomy_attributes" FOR SELECT TO "authenticated", "service_role" USING (true);



ALTER TABLE "public"."taxonomy_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."taxonomy_external_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taxonomy_external_mappings_select_for_authenticated" ON "public"."taxonomy_external_mappings" FOR SELECT TO "authenticated", "service_role" USING (true);



ALTER TABLE "public"."taxonomy_values" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taxonomy_values_select_for_authenticated" ON "public"."taxonomy_values" FOR SELECT TO "authenticated", "service_role" USING (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert_own_profile" ON "public"."users" FOR INSERT TO "authenticated", "service_role" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "brand_members_delete_owner_non_owner" ON "public"."brand_members" FOR DELETE TO "authenticated", "service_role" USING (("public"."is_brand_owner"("brand_id") AND (("role" <> 'owner'::"text") OR ("user_id" = "auth"."uid"()))));



CREATE POLICY "brand_members_delete_self" ON "public"."brand_members" FOR DELETE TO "authenticated", "service_role" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "brand_members_insert_first_owner_self" ON "public"."brand_members" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'owner'::"text") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."brand_members" "u"
  WHERE (("u"."brand_id" = "brand_members"."brand_id") AND ("u"."role" = 'owner'::"text")))))));



CREATE POLICY "brand_members_select_for_members" ON "public"."brand_members" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "brand_members_update_by_owner" ON "public"."brand_members" FOR UPDATE TO "authenticated", "service_role" USING ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "users_select_for_brand_members" ON "public"."users" FOR SELECT TO "authenticated", "service_role" USING ("public"."shares_brand_with"("id"));



CREATE POLICY "users_select_own_profile" ON "public"."users" FOR SELECT TO "authenticated", "service_role" USING (("auth"."uid"() = "id"));



CREATE POLICY "users_update_own_profile" ON "public"."users" FOR UPDATE TO "authenticated", "service_role" USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND (("brand_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."brand_members" "bm"
  WHERE (("bm"."brand_id" = "users"."brand_id") AND ("bm"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."value_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "value_mappings_delete_by_brand_member" ON "public"."value_mappings" FOR DELETE TO "authenticated" USING ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "value_mappings_insert_by_brand_member" ON "public"."value_mappings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_brand_owner"("brand_id"));



CREATE POLICY "value_mappings_select_for_brand_members" ON "public"."value_mappings" FOR SELECT TO "authenticated", "service_role" USING ("public"."is_brand_member"("brand_id"));



CREATE POLICY "value_mappings_update_by_brand_member" ON "public"."value_mappings" FOR UPDATE TO "authenticated" USING ("public"."is_brand_owner"("brand_id"));



ALTER TABLE "public"."variant_commercial" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "variant_commercial_delete_by_brand_member" ON "public"."variant_commercial" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_commercial"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_commercial_insert_by_brand_member" ON "public"."variant_commercial" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_commercial"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_commercial_select_for_brand_members" ON "public"."variant_commercial" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_commercial"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_commercial_update_by_brand_member" ON "public"."variant_commercial" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_commercial"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



ALTER TABLE "public"."variant_eco_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "variant_eco_claims_delete_by_brand_member" ON "public"."variant_eco_claims" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_eco_claims"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_eco_claims_insert_by_brand_member" ON "public"."variant_eco_claims" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_eco_claims"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_eco_claims_select_for_brand_members" ON "public"."variant_eco_claims" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_eco_claims"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_eco_claims_update_by_brand_member" ON "public"."variant_eco_claims" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_eco_claims"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



ALTER TABLE "public"."variant_environment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "variant_environment_delete_by_brand_member" ON "public"."variant_environment" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_environment"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_environment_insert_by_brand_member" ON "public"."variant_environment" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_environment"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_environment_select_for_brand_members" ON "public"."variant_environment" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_environment"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_environment_update_by_brand_member" ON "public"."variant_environment" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_environment"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



ALTER TABLE "public"."variant_journey_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "variant_journey_steps_delete_by_brand_member" ON "public"."variant_journey_steps" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_journey_steps"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_journey_steps_insert_by_brand_member" ON "public"."variant_journey_steps" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_journey_steps"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_journey_steps_select_for_brand_members" ON "public"."variant_journey_steps" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_journey_steps"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_journey_steps_update_by_brand_member" ON "public"."variant_journey_steps" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_journey_steps"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



ALTER TABLE "public"."variant_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "variant_materials_delete_by_brand_member" ON "public"."variant_materials" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_materials"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_materials_insert_by_brand_member" ON "public"."variant_materials" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_materials"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_materials_select_for_brand_members" ON "public"."variant_materials" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_materials"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_materials_update_by_brand_member" ON "public"."variant_materials" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_materials"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



ALTER TABLE "public"."variant_weight" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "variant_weight_delete_by_brand_member" ON "public"."variant_weight" FOR DELETE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_weight"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_weight_insert_by_brand_member" ON "public"."variant_weight" FOR INSERT TO "authenticated", "service_role" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_weight"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_weight_select_for_brand_members" ON "public"."variant_weight" FOR SELECT TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_weight"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));



CREATE POLICY "variant_weight_update_by_brand_member" ON "public"."variant_weight" FOR UPDATE TO "authenticated", "service_role" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_variants" "pv"
     JOIN "public"."products" "p" ON (("p"."id" = "pv"."product_id")))
  WHERE (("pv"."id" = "variant_weight"."variant_id") AND "public"."is_brand_member"("p"."brand_id")))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





























































































































































































REVOKE ALL ON FUNCTION "public"."accept_invite_from_cookie"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_invite_from_cookie"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite_from_cookie"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite_from_cookie"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."batch_insert_staging_with_status"("p_products" "jsonb", "p_variants" "jsonb", "p_status_updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."batch_insert_staging_with_status"("p_products" "jsonb", "p_variants" "jsonb", "p_status_updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."batch_insert_staging_with_status"("p_products" "jsonb", "p_variants" "jsonb", "p_status_updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_invites_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_invites_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_invites_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brands_for_authenticated_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_brands_for_authenticated_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brands_for_authenticated_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_brand_id"("product_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_brand_id"("product_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_brand_id"("product_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_brand_member"("b_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_brand_member"("b_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_brand_member"("b_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_brand_owner"("b_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_brand_owner"("b_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_brand_owner"("b_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."shares_brand_with"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."shares_brand_with"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."shares_brand_with"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";
























GRANT ALL ON TABLE "public"."brand_attribute_values" TO "anon";
GRANT ALL ON TABLE "public"."brand_attribute_values" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_attribute_values" TO "service_role";



GRANT ALL ON TABLE "public"."brand_attributes" TO "anon";
GRANT ALL ON TABLE "public"."brand_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_attributes" TO "service_role";



GRANT ALL ON TABLE "public"."brand_certifications" TO "anon";
GRANT ALL ON TABLE "public"."brand_certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_certifications" TO "service_role";



GRANT ALL ON TABLE "public"."brand_collections" TO "anon";
GRANT ALL ON TABLE "public"."brand_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_collections" TO "service_role";



GRANT ALL ON TABLE "public"."brand_eco_claims" TO "anon";
GRANT ALL ON TABLE "public"."brand_eco_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_eco_claims" TO "service_role";



GRANT ALL ON TABLE "public"."brand_facilities" TO "anon";
GRANT ALL ON TABLE "public"."brand_facilities" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_facilities" TO "service_role";



GRANT ALL ON TABLE "public"."brand_integrations" TO "anon";
GRANT ALL ON TABLE "public"."brand_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."brand_invites" TO "anon";
GRANT ALL ON TABLE "public"."brand_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_invites" TO "service_role";



GRANT ALL ON TABLE "public"."brand_manufacturers" TO "anon";
GRANT ALL ON TABLE "public"."brand_manufacturers" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_manufacturers" TO "service_role";



GRANT ALL ON TABLE "public"."brand_materials" TO "anon";
GRANT ALL ON TABLE "public"."brand_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_materials" TO "service_role";



GRANT ALL ON TABLE "public"."brand_members" TO "anon";
GRANT ALL ON TABLE "public"."brand_members" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_members" TO "service_role";



GRANT ALL ON TABLE "public"."brand_seasons" TO "anon";
GRANT ALL ON TABLE "public"."brand_seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_seasons" TO "service_role";



GRANT ALL ON TABLE "public"."brand_tags" TO "anon";
GRANT ALL ON TABLE "public"."brand_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_tags" TO "service_role";



GRANT ALL ON TABLE "public"."brand_theme" TO "anon";
GRANT ALL ON TABLE "public"."brand_theme" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_theme" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."file_assets" TO "anon";
GRANT ALL ON TABLE "public"."file_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."file_assets" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."import_rows" TO "anon";
GRANT ALL ON TABLE "public"."import_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."import_rows" TO "service_role";



GRANT ALL ON TABLE "public"."integration_certification_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_certification_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_certification_links" TO "service_role";



GRANT ALL ON TABLE "public"."integration_eco_claim_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_eco_claim_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_eco_claim_links" TO "service_role";



GRANT ALL ON TABLE "public"."integration_facility_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_facility_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_facility_links" TO "service_role";



GRANT ALL ON TABLE "public"."integration_field_configs" TO "anon";
GRANT ALL ON TABLE "public"."integration_field_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_field_configs" TO "service_role";



GRANT ALL ON TABLE "public"."integration_manufacturer_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_manufacturer_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_manufacturer_links" TO "service_role";



GRANT ALL ON TABLE "public"."integration_material_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_material_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_material_links" TO "service_role";



GRANT ALL ON TABLE "public"."integration_product_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_product_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_product_links" TO "service_role";



GRANT ALL ON TABLE "public"."integration_season_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_season_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_season_links" TO "service_role";



GRANT ALL ON TABLE "public"."integration_sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."integration_sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_sync_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."integration_tag_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_tag_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_tag_links" TO "service_role";



GRANT ALL ON TABLE "public"."integration_variant_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_variant_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_variant_links" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_states" TO "anon";
GRANT ALL ON TABLE "public"."oauth_states" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_states" TO "service_role";



GRANT ALL ON TABLE "public"."product_commercial" TO "anon";
GRANT ALL ON TABLE "public"."product_commercial" TO "authenticated";
GRANT ALL ON TABLE "public"."product_commercial" TO "service_role";



GRANT ALL ON TABLE "public"."product_eco_claims" TO "anon";
GRANT ALL ON TABLE "public"."product_eco_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."product_eco_claims" TO "service_role";



GRANT ALL ON TABLE "public"."product_environment" TO "anon";
GRANT ALL ON TABLE "public"."product_environment" TO "authenticated";
GRANT ALL ON TABLE "public"."product_environment" TO "service_role";



GRANT ALL ON TABLE "public"."product_journey_steps" TO "anon";
GRANT ALL ON TABLE "public"."product_journey_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."product_journey_steps" TO "service_role";



GRANT ALL ON TABLE "public"."product_materials" TO "anon";
GRANT ALL ON TABLE "public"."product_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."product_materials" TO "service_role";



GRANT ALL ON TABLE "public"."product_tags" TO "anon";
GRANT ALL ON TABLE "public"."product_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."product_tags" TO "service_role";



GRANT ALL ON TABLE "public"."product_variant_attributes" TO "anon";
GRANT ALL ON TABLE "public"."product_variant_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variant_attributes" TO "service_role";



GRANT ALL ON TABLE "public"."product_variants" TO "anon";
GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variants" TO "service_role";



GRANT ALL ON TABLE "public"."product_weight" TO "anon";
GRANT ALL ON TABLE "public"."product_weight" TO "authenticated";
GRANT ALL ON TABLE "public"."product_weight" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."staging_product_eco_claims" TO "anon";
GRANT ALL ON TABLE "public"."staging_product_eco_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_product_eco_claims" TO "service_role";



GRANT ALL ON TABLE "public"."staging_product_environment" TO "anon";
GRANT ALL ON TABLE "public"."staging_product_environment" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_product_environment" TO "service_role";



GRANT ALL ON TABLE "public"."staging_product_journey_steps" TO "anon";
GRANT ALL ON TABLE "public"."staging_product_journey_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_product_journey_steps" TO "service_role";



GRANT ALL ON TABLE "public"."staging_product_materials" TO "anon";
GRANT ALL ON TABLE "public"."staging_product_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_product_materials" TO "service_role";



GRANT ALL ON TABLE "public"."staging_product_tags" TO "anon";
GRANT ALL ON TABLE "public"."staging_product_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_product_tags" TO "service_role";



GRANT ALL ON TABLE "public"."staging_product_variants" TO "anon";
GRANT ALL ON TABLE "public"."staging_product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_product_variants" TO "service_role";



GRANT ALL ON TABLE "public"."staging_products" TO "anon";
GRANT ALL ON TABLE "public"."staging_products" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_products" TO "service_role";



GRANT ALL ON TABLE "public"."taxonomy_attributes" TO "anon";
GRANT ALL ON TABLE "public"."taxonomy_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."taxonomy_attributes" TO "service_role";



GRANT ALL ON TABLE "public"."taxonomy_categories" TO "anon";
GRANT ALL ON TABLE "public"."taxonomy_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."taxonomy_categories" TO "service_role";



GRANT ALL ON TABLE "public"."taxonomy_external_mappings" TO "anon";
GRANT ALL ON TABLE "public"."taxonomy_external_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."taxonomy_external_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."taxonomy_values" TO "anon";
GRANT ALL ON TABLE "public"."taxonomy_values" TO "authenticated";
GRANT ALL ON TABLE "public"."taxonomy_values" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."value_mappings" TO "anon";
GRANT ALL ON TABLE "public"."value_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."value_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."variant_commercial" TO "anon";
GRANT ALL ON TABLE "public"."variant_commercial" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_commercial" TO "service_role";



GRANT ALL ON TABLE "public"."variant_eco_claims" TO "anon";
GRANT ALL ON TABLE "public"."variant_eco_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_eco_claims" TO "service_role";



GRANT ALL ON TABLE "public"."variant_environment" TO "anon";
GRANT ALL ON TABLE "public"."variant_environment" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_environment" TO "service_role";



GRANT ALL ON TABLE "public"."variant_journey_steps" TO "anon";
GRANT ALL ON TABLE "public"."variant_journey_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_journey_steps" TO "service_role";



GRANT ALL ON TABLE "public"."variant_materials" TO "anon";
GRANT ALL ON TABLE "public"."variant_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_materials" TO "service_role";



GRANT ALL ON TABLE "public"."variant_weight" TO "anon";
GRANT ALL ON TABLE "public"."variant_weight" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_weight" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
