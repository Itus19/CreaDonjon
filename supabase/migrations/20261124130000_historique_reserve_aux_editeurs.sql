-- AG-12 (et faille trouvée en le préparant, docs/SECURITE.md) — l'historique
-- des fiches n'est plus lisible par tout membre du monde.
--
-- entity_revisions.snapshot est un instantané COMPLET de la fiche, blocs
-- réservés au MJ compris (migration 20260804160001, entity_blocks_full).
-- La politique de lecture ne demandait que d'être membre du monde : le
-- serveur refiltrait avant l'affichage, mais une joueuse pouvait lire la
-- table directement avec sa propre session (clé publique + son jeton) et y
-- trouver les blocs MJ de toutes les fiches, et les noms d'origine.
--
-- Désormais : le MJ du monde, le superadmin (journal fusionné, V2-M6), et
-- qui peut modifier la fiche (sa propre fiche de PJ, son devoir de journal).
-- Conséquence : le journal d'une joueuse ne montre plus les révisions des
-- fiches des autres PJ, seulement les siennes.
--
-- La politique d'écriture était `for all` (is_world_member) : une
-- politique `for all` vaut aussi pour la lecture, et les politiques
-- permissives s'additionnent. Elle devient une politique d'INSERTION seule :
-- une révision ne se modifie ni ne se supprime jamais (règle absolue 17).
drop policy if exists entity_revisions_write on entity_revisions;
create policy entity_revisions_insert on entity_revisions for insert
  with check (app.is_world_member(app.entity_world_id(entity_id)));

drop policy if exists entity_revisions_select on entity_revisions;
create policy entity_revisions_select on entity_revisions for select
  using (
    app.is_superadmin()
    or app.is_world_admin(app.entity_world_id(entity_id))
    or app.can_edit_entity(entity_id)
  );

-- La numérotation d'une révision lit le maximum existant, et l'insertion
-- relit la ligne (`returning`) : sous la nouvelle politique, une personne
-- qui écrit sur une fiche sans pouvoir lire son historique (un geste du
-- moteur sur la fiche d'un autre PJ, par exemple) lirait un maximum faux et
-- serait refusée au `returning`. La fonction passe donc en security
-- definer, avec la même porte qu'avant (membre du monde de la fiche).
create or replace function public.insert_entity_revision(
  p_entity_id uuid,
  p_snapshot jsonb,
  p_change_source text,
  p_change_note text,
  p_changed_by uuid
)
returns entity_revisions
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_row entity_revisions;
begin
  if not app.is_world_member(app.entity_world_id(p_entity_id)) then
    raise exception 'insert_entity_revision : réservé aux membres du monde de la fiche'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_entity_id::text, 0));

  insert into entity_revisions (entity_id, revision_number, snapshot, change_source, change_note, changed_by)
  select p_entity_id, coalesce(max(revision_number), 0) + 1, p_snapshot, p_change_source, p_change_note, p_changed_by
  from entity_revisions
  where entity_id = p_entity_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.insert_entity_revision(uuid, jsonb, text, text, uuid) from public;
grant execute on function public.insert_entity_revision(uuid, jsonb, text, text, uuid) to authenticated;
