-- Phase 2A fix:
-- Allow account creation hook to pass when the email already exists in auth.users.
-- This keeps strict invite-only for net-new accounts while not blocking existing users.

create or replace function public.before_user_created_invite_gate(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text;
begin
  v_email := lower(
    trim(
      coalesce(
        event -> 'user' ->> 'email',
        event ->> 'email',
        event -> 'new_record' ->> 'email',
        ''
      )
    )
  );

  if v_email = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'account_not_found'
      )
    );
  end if;

  if public.has_pending_invite_email(v_email)
     or public.has_auth_user_email(v_email) then
    return event;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'account_not_found'
    )
  );
end;
$$;

alter function public.before_user_created_invite_gate(jsonb) owner to postgres;

grant execute on function public.before_user_created_invite_gate(jsonb) to service_role;
grant execute on function public.before_user_created_invite_gate(jsonb) to supabase_auth_admin;
