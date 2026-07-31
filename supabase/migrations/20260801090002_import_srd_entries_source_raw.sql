-- Complete app.import_srd_entries (migration 20260730180001) pour deposer
-- l'objet JSON source integral dans ruleset_entries.source_raw (colonne
-- ajoutee par la migration precedente, specs/outils-mj.md §1). La fonction
-- est deja appliquee : on la remplace via create or replace, on ne modifie
-- pas le fichier de migration original (CLAUDE.md, regle absolue 10).

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
    insert into ruleset_entries (ruleset_id, entry_key, entry_type, ai_digest, source_attribution, source_raw)
    values (
      p_ruleset_id,
      v_entry->>'entry_key',
      v_entry->>'entry_type',
      v_entry->>'ai_digest',
      v_entry->>'source_attribution',
      v_entry->'source_raw'
    )
    on conflict (ruleset_id, entry_key) do update
      set entry_type          = excluded.entry_type,
          ai_digest           = excluded.ai_digest,
          source_attribution  = excluded.source_attribution,
          source_raw          = excluded.source_raw,
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
