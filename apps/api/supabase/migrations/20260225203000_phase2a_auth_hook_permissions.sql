-- Phase 2A follow-up: ensure Supabase auth hook role can execute hook function.

grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created_invite_gate(jsonb) to supabase_auth_admin;
