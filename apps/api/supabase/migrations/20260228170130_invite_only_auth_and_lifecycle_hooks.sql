CREATE OR REPLACE FUNCTION "public"."is_brand_owner"("b_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.brand_members bm
    where bm.brand_id = b_id
      and bm.user_id = auth.uid()
      and bm.role = any(array['owner'::text, 'avelero'::text])
  );
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."is_brand_owner"("b_id" "uuid") OWNER TO "postgres";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."accept_invite_from_cookie"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_now         timestamptz := now();
  v_trial_ends  timestamptz := now() + interval '14 days';
  v_token_hash  text;
  v_email       text;
  v_brand       uuid;
  v_role        text;
  v_user_email  text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

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
  v_user_email := lower(trim(coalesce(auth.email(), auth.jwt() ->> 'email')));
  if v_user_email is null or v_user_email = '' then
    raise exception 'Authenticated user email not found';
  end if;

  if lower(trim(v_email)) <> v_user_email then
    raise exception 'Invite does not belong to the current user';
  end if;

  -- Create or elevate membership
  insert into public.brand_members(user_id, brand_id, role)
  values (auth.uid(), v_brand, v_role)
  on conflict (user_id, brand_id) do update
  set role = excluded.role;

  -- First non-admin acceptance transitions demo -> trial
  if v_role = any(array['owner'::text, 'member'::text]) then
    update public.brand_lifecycle
      set phase = 'trial',
          phase_changed_at = v_now,
          trial_started_at = v_now,
          trial_ends_at = v_trial_ends
    where brand_id = v_brand
      and phase = 'demo';
  end if;

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
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."accept_invite_from_cookie"("p_token" "text") OWNER TO "postgres";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."has_pending_invite_email"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1
    from public.brand_invites bi
    where lower(trim(bi.email)) = lower(trim(coalesce(p_email, '')))
      and (bi.expires_at is null or bi.expires_at > now())
  );
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."has_pending_invite_email"("p_email" "text") OWNER TO "postgres";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."has_auth_user_email"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'auth'
    AS $$
  select exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = lower(trim(coalesce(p_email, '')))
  );
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."has_auth_user_email"("p_email" "text") OWNER TO "postgres";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_email text;
begin
  -- Supabase hook payload shape can vary by flow/provider.
  -- Normalize from known locations before enforcing invite-only policy.
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
        'message', 'INVITE_REQUIRED',
        'code', 'INVITE_REQUIRED'
      )
    );
  end if;

  -- Existing auth users can still sign in.
  if public.has_pending_invite_email(v_email)
     or public.has_auth_user_email(v_email) then
    return event;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'INVITE_REQUIRED',
      'code', 'INVITE_REQUIRED'
    )
  );
end;
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") OWNER TO "postgres";

--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."before-user-created-hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  return public.before_user_created_invite_gate(event);
end;
$$;
--> statement-breakpoint
ALTER FUNCTION "public"."before-user-created-hook"("event" "jsonb") OWNER TO "postgres";

--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_pending_invite_email"("p_email" "text") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_auth_user_email"("p_email" "text") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."before_user_created_invite_gate"("event" "jsonb") TO "supabase_auth_admin";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."before-user-created-hook"("event" "jsonb") TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."before-user-created-hook"("event" "jsonb") TO "supabase_auth_admin";
