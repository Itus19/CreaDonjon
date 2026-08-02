-- V1-A2 : la deduplication des aptitudes generiques (script d'import) reduit
-- le nombre d'entry_key produits pour une categorie donnee (ex : les 63
-- variantes par classe de "Ability Score Improvement" deviennent 3 fiches
-- partagees). app.import_srd_entries ne fait qu'upserter : sans ce
-- complement, les anciennes cles disparues du jeu de donnees resteraient en
-- base indefiniment. Meme contournement du verrou is_official_base que les
-- fonctions d'import (migration 20260730180001), pour la meme raison.
create or replace function app.import_prune_stale_entries(p_ruleset_id uuid, p_valid_keys text[])
returns int
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_count int;
begin
  perform set_config('app.allow_official_writes', 'on', true);

  with deleted as (
    delete from ruleset_entries
    where ruleset_id = p_ruleset_id
      and entry_key <> all(p_valid_keys)
    returning 1
  )
  select count(*) into v_count from deleted;

  return v_count;
end;
$$;

revoke execute on function app.import_prune_stale_entries(uuid, text[]) from public;

-- Reserve au script d'import (scripts/ingest-srd.ts), meme raison que les
-- fonctions d'import elles-memes.
grant execute on function app.import_prune_stale_entries(uuid, text[]) to service_role;
