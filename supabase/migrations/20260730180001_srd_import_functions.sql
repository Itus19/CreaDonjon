-- Migration pour P0-08 : fonctions dediees a l'import du SRD, seul endroit
-- autorise a activer app.allow_official_writes (migration 004, commentaire
-- de app.forbid_official_ruleset_entry_write). Le contournement est actif
-- uniquement pour la duree de l'appel (set_config ... true = local a la
-- transaction), jamais expose ailleurs.

-- Retrouve le ruleset officiel d'un base_system, ou le cree s'il n'existe
-- pas encore. Idempotent par construction : jamais de deuxieme ligne pour
-- le meme base_system officiel.
create or replace function app.import_upsert_ruleset(p_base_system text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_id uuid;
begin
  select id into v_id from rulesets where is_official_base and base_system = p_base_system limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into rulesets (name, base_system, is_official_base, created_by)
  values (p_name, p_base_system, true, null)
  returning id into v_id;

  return v_id;
end;
$$;

-- Importe un lot d'entrees (et leurs blocs) pour un ruleset officiel donne.
-- p_entries : jsonb[{ entry_key, entry_type, ai_digest, source_attribution,
--                      blocks: [{ block_type, display, data, display_order? }] }]
-- Upsert par (ruleset_id, entry_key) ; les blocs sont recrees a chaque
-- passage (supprimes puis reinseres) plutot qu'upsertes un par un — plus
-- simple, et tout aussi idempotent puisque le contenu final est identique.
create or replace function app.import_srd_entries(p_ruleset_id uuid, p_entries jsonb)
returns int
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_entry jsonb;
  v_entry_id uuid;
  v_block jsonb;
  v_count int := 0;
begin
  perform set_config('app.allow_official_writes', 'on', true);

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into ruleset_entries (ruleset_id, entry_key, entry_type, ai_digest, source_attribution)
    values (
      p_ruleset_id,
      v_entry->>'entry_key',
      v_entry->>'entry_type',
      v_entry->>'ai_digest',
      v_entry->>'source_attribution'
    )
    on conflict (ruleset_id, entry_key) do update
      set entry_type          = excluded.entry_type,
          ai_digest           = excluded.ai_digest,
          source_attribution  = excluded.source_attribution,
          updated_at          = now()
    returning id into v_entry_id;

    delete from ruleset_entry_blocks where entry_id = v_entry_id;

    for v_block in select * from jsonb_array_elements(coalesce(v_entry->'blocks', '[]'::jsonb))
    loop
      insert into ruleset_entry_blocks (entry_id, block_type, display, data, display_order)
      values (
        v_entry_id,
        v_block->>'block_type',
        coalesce(v_block->'display', '{}'::jsonb),
        coalesce(v_block->'data', '{}'::jsonb),
        coalesce((v_block->>'display_order')::numeric, 1000)
      );
    end loop;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function app.import_upsert_ruleset(text, text) from public;
revoke execute on function app.import_srd_entries(uuid, jsonb)    from public;

-- Reserve au script d'import (scripts/ingest-srd.ts), qui s'authentifie
-- avec la cle service_role. Aucun role client (anon, authenticated) n'a
-- de raison d'appeler ces fonctions.
grant execute on function app.import_upsert_ruleset(text, text) to service_role;
grant execute on function app.import_srd_entries(uuid, jsonb)    to service_role;
