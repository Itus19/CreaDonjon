-- V1-A4 : verrou de publication (SCHEMA.md §9.4, §9.5) — "un ruleset publie
-- est fige : toute edition cree version + 1 avec le meme lineage_id".
--
-- Meme idiome que app.delete_own_account (migration 20260801160001) :
-- security definer + auth.uid() lu a l'interieur de la fonction, jamais un
-- id d'acteur passe en parametre ni un client service-role cote
-- TypeScript. Ces fonctions n'ont pas besoin du contournement
-- app.allow_official_writes (reserve a l'import SRD, migration
-- 20260730180001) : elles ne touchent jamais un ruleset officiel, elles le
-- refusent explicitement (CLAUDE.md regle 12 — un ruleset officiel n'est
-- jamais modifie, toute variante est un NOUVEAU ruleset).

create or replace function app.upsert_ruleset_override(
  p_ruleset_id uuid,
  p_entry_key   text,
  p_block_type  text,
  p_action      text,
  p_payload     jsonb,
  p_patch       jsonb,
  p_note        text
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_ruleset rulesets%rowtype;
  v_target_ruleset_id uuid;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Aucun utilisateur authentifie';
  end if;

  select * into v_ruleset from rulesets where id = p_ruleset_id;
  if v_ruleset.id is null then
    raise exception 'Ruleset introuvable';
  end if;
  if v_ruleset.is_official_base then
    raise exception 'Un ruleset officiel ne recoit jamais de surcharge directe : creez une variante (parent_ruleset_id)';
  end if;
  if v_ruleset.created_by is distinct from v_caller then
    raise exception 'Seul le createur de ce ruleset peut le modifier';
  end if;

  if v_ruleset.published_at is not null then
    -- Fige : on cree une nouvelle version, meme lineage_id, et on lui copie
    -- les surcharges existantes avant d'appliquer la nouvelle (sans quoi la
    -- v+1 "oublierait" tout ce que la version figee portait deja).
    insert into rulesets (name, base_system, parent_ruleset_id, version, is_official_base, lineage_id, created_by)
    values (v_ruleset.name, v_ruleset.base_system, v_ruleset.parent_ruleset_id, v_ruleset.version + 1, false, v_ruleset.lineage_id, v_caller)
    returning id into v_target_ruleset_id;

    insert into ruleset_overrides (ruleset_id, entry_key, block_type, action, payload, patch, note, created_by)
    select v_target_ruleset_id, entry_key, block_type, action, payload, patch, note, created_by
      from ruleset_overrides
     where ruleset_id = v_ruleset.id;
  else
    v_target_ruleset_id := v_ruleset.id;
  end if;

  insert into ruleset_overrides (ruleset_id, entry_key, block_type, action, payload, patch, note, created_by)
  values (v_target_ruleset_id, p_entry_key, p_block_type, p_action, p_payload, p_patch, p_note, v_caller)
  on conflict (ruleset_id, entry_key, coalesce(block_type, ''))
  do update set action = excluded.action, payload = excluded.payload, patch = excluded.patch, note = excluded.note, created_by = excluded.created_by;

  return v_target_ruleset_id;
end;
$$;

revoke all on function app.upsert_ruleset_override(uuid, text, text, text, jsonb, jsonb, text) from public;
grant execute on function app.upsert_ruleset_override(uuid, text, text, text, jsonb, jsonb, text) to authenticated;

create or replace function public.upsert_ruleset_override(
  p_ruleset_id uuid,
  p_entry_key   text,
  p_block_type  text,
  p_action      text,
  p_payload     jsonb,
  p_patch       jsonb,
  p_note        text
)
returns uuid
language sql
security invoker
set search_path = public, app
as $$
  select app.upsert_ruleset_override(p_ruleset_id, p_entry_key, p_block_type, p_action, p_payload, p_patch, p_note);
$$;

revoke all on function public.upsert_ruleset_override(uuid, text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.upsert_ruleset_override(uuid, text, text, text, jsonb, jsonb, text) to authenticated;

-- Publier fige la version courante ; idempotent (deja publie = aucun effet).
create or replace function app.publish_ruleset(p_ruleset_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_ruleset rulesets%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Aucun utilisateur authentifie';
  end if;

  select * into v_ruleset from rulesets where id = p_ruleset_id;
  if v_ruleset.id is null then
    raise exception 'Ruleset introuvable';
  end if;
  if v_ruleset.is_official_base then
    raise exception 'Un ruleset officiel est deja fige par construction';
  end if;
  if v_ruleset.created_by is distinct from v_caller then
    raise exception 'Seul le createur de ce ruleset peut le publier';
  end if;

  update rulesets set published_at = now() where id = p_ruleset_id and published_at is null;
end;
$$;

revoke all on function app.publish_ruleset(uuid) from public;
grant execute on function app.publish_ruleset(uuid) to authenticated;

create or replace function public.publish_ruleset(p_ruleset_id uuid)
returns void
language sql
security invoker
set search_path = public, app
as $$
  select app.publish_ruleset(p_ruleset_id);
$$;

revoke all on function public.publish_ruleset(uuid) from public;
grant execute on function public.publish_ruleset(uuid) to authenticated;
