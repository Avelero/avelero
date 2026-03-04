CREATE OR REPLACE FUNCTION "public"."has_brand_membership_user_id"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1
    from public.brand_members bm
    where bm.user_id = p_user_id
  );
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."has_brand_membership_user_id"("p_user_id" "uuid") OWNER TO "postgres";

--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."has_brand_membership_user_id"("p_user_id" "uuid") FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_brand_membership_user_id"("p_user_id" "uuid") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_brand_membership_user_id"("p_user_id" "uuid") TO "supabase_auth_admin";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."has_brand_membership_email"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'auth'
    AS $$
  select exists (
    select 1
    from auth.users au
    where lower(trim(au.email)) = lower(trim(coalesce(p_email, '')))
      and exists (
        select 1
        from public.brand_members bm
        where bm.user_id = au.id
      )
  );
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."has_brand_membership_email"("p_email" "text") OWNER TO "postgres";

--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."has_brand_membership_email"("p_email" "text") FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_brand_membership_email"("p_email" "text") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_brand_membership_email"("p_email" "text") TO "supabase_auth_admin";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_email text;
begin
  v_email := lower(
    trim(
      coalesce(
        event -> 'user' ->> 'email',
        event ->> 'email',
        event -> 'new_record' ->> 'email',
        event -> 'record' ->> 'email',
        ''
      )
    )
  );

  if v_email = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'AUTH_GATE_DENIED',
        'code', 'AUTH_GATE_DENIED'
      )
    );
  end if;

  if public.has_pending_invite_email(v_email)
     or public.has_platform_admin_email(v_email) then
    return event;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'AUTH_GATE_DENIED',
      'code', 'AUTH_GATE_DENIED'
    )
  );
end;
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") OWNER TO "postgres";

--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") TO "supabase_auth_admin";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."custom_access_token_auth_gate"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'auth'
    AS $$
declare
  v_email text;
  v_uid_text text;
  v_uid uuid;
begin
  v_email := lower(
    trim(
      coalesce(
        event -> 'user' ->> 'email',
        event ->> 'email',
        event -> 'record' ->> 'email',
        event -> 'new_record' ->> 'email',
        event -> 'claims' ->> 'email',
        ''
      )
    )
  );

  v_uid_text := trim(
    coalesce(
      event -> 'user' ->> 'id',
      event ->> 'user_id',
      event -> 'record' ->> 'id',
      event -> 'new_record' ->> 'id',
      event -> 'claims' ->> 'sub',
      ''
    )
  );

  if v_uid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_uid := v_uid_text::uuid;
  else
    v_uid := null;
  end if;

  if v_email = '' and v_uid is not null then
    select lower(trim(u.email))
      into v_email
    from auth.users u
    where u.id = v_uid
    limit 1;
  end if;

  if v_email = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'AUTH_GATE_DENIED',
        'code', 'AUTH_GATE_DENIED'
      )
    );
  end if;

  if public.has_platform_admin_email(v_email)
     or public.has_pending_invite_email(v_email)
     or public.has_brand_membership_email(v_email)
     or (v_uid is not null and public.has_brand_membership_user_id(v_uid)) then
    return event;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'AUTH_GATE_DENIED',
      'code', 'AUTH_GATE_DENIED'
    )
  );
end;
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."custom_access_token_auth_gate"("event" "jsonb") OWNER TO "postgres";

--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."custom_access_token_auth_gate"("event" "jsonb") FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."custom_access_token_auth_gate"("event" "jsonb") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."custom_access_token_auth_gate"("event" "jsonb") TO "supabase_auth_admin";

--> statement-breakpoint
INSERT INTO "public"."platform_admin_allowlist" ("email", "user_id", "created_at", "updated_at")
VALUES
  ('raf@avelero.com', NULL, now(), now()),
  ('moussa@avelero.com', NULL, now(), now())
ON CONFLICT ("email") DO UPDATE
SET "updated_at" = EXCLUDED."updated_at";
