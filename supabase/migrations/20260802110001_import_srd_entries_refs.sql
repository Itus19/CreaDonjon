-- V1-A3 : app.import_srd_entries (migrations 20260730180001, 20260801090002)
-- recalcule desormais les renvois `derived` de chaque entree en meme temps
-- que ses blocs — jamais les renvois `declared` (SCHEMA.md §9.3 : "les
-- renvois derived sont recalcules a chaque ecriture ; les declared ne sont
-- jamais touches"). target_entry_id est resolu dans le MEME ruleset que
-- l'entree source : c'est la seule resolution valide tant que la surcharge
-- (V1-A4) n'existe pas — une entree officielle ne renvoie qu'a d'autres
-- entrees du meme ruleset officiel, jamais a une variante.
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
  v_ref jsonb;
  v_target_entry_id uuid;
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

    delete from ruleset_entry_refs where source_entry_id = v_entry_id and origin = 'derived';

    for v_ref in select * from jsonb_array_elements(coalesce(v_entry->'refs', '[]'::jsonb))
    loop
      select re.id into v_target_entry_id
        from ruleset_entries re
       where re.ruleset_id = p_ruleset_id and re.entry_key = v_ref->>'target_key';

      insert into ruleset_entry_refs (source_entry_id, target_key, target_entry_id, ref_kind, origin, path)
      values (
        v_entry_id,
        v_ref->>'target_key',
        v_target_entry_id,
        v_ref->>'ref_kind',
        'derived',
        v_ref->>'path'
      )
      on conflict (source_entry_id, target_key, ref_kind, coalesce(path, ''))
      do update set target_entry_id = excluded.target_entry_id;
    end loop;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
