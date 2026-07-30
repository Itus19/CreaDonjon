-- PostgREST n'expose que le schema public par defaut : le script d'import
-- ne peut pas appeler app.import_upsert_ruleset / app.import_srd_entries
-- via supabase.rpc(...). Plutot que d'exposer tout le schema app a l'API
-- (il est concu comme prive, invoque depuis les politiques RLS, pas comme
-- surface RPC), on ajoute deux enveloppes fines dans public qui delegent.

create or replace function public.import_upsert_ruleset(p_base_system text, p_name text)
returns uuid
language sql
security definer
set search_path = public, app
as $$
  select app.import_upsert_ruleset(p_base_system, p_name);
$$;

create or replace function public.import_srd_entries(p_ruleset_id uuid, p_entries jsonb)
returns int
language sql
security definer
set search_path = public, app
as $$
  select app.import_srd_entries(p_ruleset_id, p_entries);
$$;

revoke execute on function public.import_upsert_ruleset(text, text) from public;
revoke execute on function public.import_srd_entries(uuid, jsonb)    from public;

grant execute on function public.import_upsert_ruleset(text, text) to service_role;
grant execute on function public.import_srd_entries(uuid, jsonb)    to service_role;
