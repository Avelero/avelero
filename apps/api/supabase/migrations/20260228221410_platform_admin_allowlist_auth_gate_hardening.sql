CREATE OR REPLACE FUNCTION "public"."has_platform_admin_email"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1
    from public.platform_admin_allowlist pal
    where lower(trim(pal.email)) = lower(trim(coalesce(p_email, '')))
  );
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."has_platform_admin_email"("p_email" "text") OWNER TO "postgres";

--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."has_platform_admin_email"("p_email" "text") FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_platform_admin_email"("p_email" "text") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_platform_admin_email"("p_email" "text") TO "supabase_auth_admin";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."is_platform_admin_actor"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'auth'
    AS $$
declare
  v_uid uuid;
  v_email text;
begin
  v_uid := auth.uid();
  v_email := lower(trim(coalesce(auth.email(), auth.jwt() ->> 'email', '')));

  if v_uid is null or v_email = '' then
    return false;
  end if;

  return exists (
    select 1
    from public.platform_admin_allowlist pal
    where lower(trim(pal.email)) = v_email
      and (pal.user_id is null or pal.user_id = v_uid)
  );
end;
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."is_platform_admin_actor"() OWNER TO "postgres";

--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."is_platform_admin_actor"() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_platform_admin_actor"() TO "authenticated";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_platform_admin_actor"() TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_platform_admin_actor"() TO "supabase_auth_admin";

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
     or public.has_auth_user_email(v_email)
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
