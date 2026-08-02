-- PostgREST n'expose que public (voir migration 20260730180002) : le script
-- d'import ne peut pas appeler app.import_prune_stale_entries directement.
-- Meme enveloppe fine que import_upsert_ruleset / import_srd_entries.
create or replace function public.import_prune_stale_entries(p_ruleset_id uuid, p_valid_keys text[])
returns int
language sql
security definer
set search_path = public, app
as $$
  select app.import_prune_stale_entries(p_ruleset_id, p_valid_keys);
$$;

revoke execute on function public.import_prune_stale_entries(uuid, text[]) from public;
grant execute on function public.import_prune_stale_entries(uuid, text[]) to service_role;
