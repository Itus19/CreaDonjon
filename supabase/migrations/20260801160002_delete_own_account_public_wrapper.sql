-- PostgREST n'expose que le schema public par defaut (meme constat que
-- 20260730180002_srd_import_public_wrappers.sql) : app.delete_own_account
-- reste invisible a supabase.rpc(...) sans cette enveloppe fine.
create or replace function public.delete_own_account()
returns void
language sql
security invoker
set search_path = public, app
as $$
  select app.delete_own_account();
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
