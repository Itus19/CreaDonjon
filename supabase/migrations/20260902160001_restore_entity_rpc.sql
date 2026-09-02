-- Retour utilisateur : un bouton "Rétablir" pour les fiches supprimées,
-- dans le Journal d'historique. Lister des fiches `deleted_at is not
-- null` est impossible via le client normal (RLS `entities_select` les
-- masque justement) ; les restaurer se heurterait au meme conflit
-- structurel documente dans l'ADR 0019 en sens inverse. Meme patron que
-- `public.soft_delete_entity` : deux fonctions `security definer` +
-- `row_security = off`, verification de droit explicite a l'interieur.
create or replace function public.list_deleted_entities(p_world_id uuid)
returns table (id uuid, name text, slug text, entity_kind text, deleted_at timestamptz)
language plpgsql security definer set search_path = public, app set row_security = off as $$
begin
  if not app.is_world_admin(p_world_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select e.id, e.name, e.slug, e.entity_kind, e.deleted_at
    from entities e
    where e.world_id = p_world_id and e.deleted_at is not null
    order by e.deleted_at desc;
end;
$$;

revoke execute on function public.list_deleted_entities(uuid) from public;
grant execute on function public.list_deleted_entities(uuid) to authenticated;

create or replace function public.restore_entity(p_entity_id uuid)
returns boolean
language plpgsql security definer set search_path = public, app set row_security = off as $$
begin
  if not app.can_edit_entity(p_entity_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update entities set deleted_at = null where id = p_entity_id and deleted_at is not null;
  return found;
end;
$$;

revoke execute on function public.restore_entity(uuid) from public;
grant execute on function public.restore_entity(uuid) to authenticated;
