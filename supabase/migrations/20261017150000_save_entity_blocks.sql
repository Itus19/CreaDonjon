-- V3.1-31 — l'éditeur plein écran enregistre une fiche d'un seul geste.
--
-- Jusqu'ici chaque bloc s'écrivait seul (`PATCH /api/blocks/[id]`, contrôle
-- de version par bloc). L'éditeur en accordéon garde un brouillon de
-- plusieurs blocs, réordonnés, et « Enregistrer » doit tout écrire ou RIEN :
-- un conflit sur le troisième bloc ne doit pas laisser les deux premiers
-- écrits. Une transaction, donc une fonction : PostgREST n'en ouvre pas
-- d'autre.
--
-- `security invoker` : la RLS de `blocks` (`blocks_update`) s'applique comme
-- à l'écriture d'un bloc seul — cette fonction n'ouvre aucun droit. Le
-- service vérifie avant elle `canEditEntity`, l'appartenance de chaque bloc
-- à la fiche et la forme de chaque `data` (Zod, par type de bloc).
--
-- Un changement porte l'état COMPLET du bloc (comme le PATCH d'un bloc) :
-- `id`, `version` (attendue), `display`, `data`, `visibility_level`,
-- `visibility_scope_id`, `display_order`.
--
-- Version périmée, bloc d'une autre fiche ou invisible : erreur `PT409`
-- (PostgREST répond 409), et la transaction entière est annulée.

create function public.save_entity_blocks(p_entity uuid, p_changes jsonb)
returns setof blocks
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_change jsonb;
  v_row blocks;
begin
  if p_entity is null or p_changes is null or jsonb_typeof(p_changes) <> 'array'
     or jsonb_array_length(p_changes) = 0 or jsonb_array_length(p_changes) > 100 then
    raise exception 'changements de blocs invalides' using errcode = '22023';
  end if;

  for v_change in select value from jsonb_array_elements(p_changes) loop
    update blocks
       set display             = v_change -> 'display',
           data                = v_change -> 'data',
           visibility_level    = v_change ->> 'visibility_level',
           visibility_scope_id = (v_change ->> 'visibility_scope_id')::uuid,
           display_order       = (v_change ->> 'display_order')::numeric,
           version             = version + 1
     where id = (v_change ->> 'id')::uuid
       and entity_id = p_entity
       and version = (v_change ->> 'version')::int
    returning * into v_row;

    if not found then
      raise exception 'bloc % : version périmée ou bloc hors de la fiche', v_change ->> 'id'
        using errcode = 'PT409';
    end if;
    return next v_row;
  end loop;
end;
$$;

revoke execute on function public.save_entity_blocks(uuid, jsonb) from public, anon;
grant execute on function public.save_entity_blocks(uuid, jsonb) to authenticated;
