-- V3.1-143 — qui a supprimé une fiche.
--
-- Le journal dit « supprimée le 6 oct. par Gabriel », mais la base ne
-- gardait que la date (`deleted_at`). Nouvelle colonne `deleted_by`,
-- remplie par la BASE, jamais par l'application : un déclencheur pose
-- `auth.uid()` quand `deleted_at` passe de null à une date, l'efface quand
-- la fiche est rétablie, et garde l'ancienne valeur sinon. Aucun chemin de
-- suppression ne peut l'oublier (`soft_delete_entity` comme un `update`
-- direct), et une écriture de `deleted_by` par un client est toujours
-- écrasée. `auth.uid()` se lit aussi dans une fonction `security definer`
-- (il vient des claims de la requête), donc via `soft_delete_entity`.
--
-- Référence `auth.users`, comme `created_by` : une suppression ne doit
-- jamais échouer parce qu'un compte n'aurait pas de ligne de profil.
-- Les suppressions d'avant cette migration restent sans auteur. RLS
-- inchangée : la colonne suit la ligne.

alter table entities
  add column deleted_by uuid references auth.users(id) on delete set null;

comment on column entities.deleted_by is 'V3.1-143 : le compte qui a supprimé la fiche. Posé par le déclencheur stamp_entities_deleted_by, jamais par le client ; null si la fiche est vivante ou supprimée avant V3.1-143.';

create or replace function app.stamp_entity_deleted_by()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if new.deleted_at is null then
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_by := auth.uid();
  else
    new.deleted_by := old.deleted_by;
  end if;
  return new;
end;
$$;

create trigger stamp_entities_deleted_by
  before insert or update on entities
  for each row execute function app.stamp_entity_deleted_by();

-- La corbeille rend aussi l'auteur. Le type de retour change : il faut
-- supprimer puis recréer la fonction (et ses droits).
drop function public.list_deleted_entities(uuid);

create function public.list_deleted_entities(p_world_id uuid)
returns table (id uuid, name text, slug text, entity_kind text, deleted_at timestamptz, deleted_by uuid)
language plpgsql security definer set search_path = public, app set row_security = off as $$
begin
  if not app.is_world_admin(p_world_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select e.id, e.name, e.slug, e.entity_kind, e.deleted_at, e.deleted_by
    from entities e
    where e.world_id = p_world_id and e.deleted_at is not null
    order by e.deleted_at desc;
end;
$$;

revoke execute on function public.list_deleted_entities(uuid) from public;
grant execute on function public.list_deleted_entities(uuid) to authenticated;
